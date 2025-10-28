const { default: makeWASocket, DisconnectReason, jidNormalizedUser, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const { Boom } = require('@hapi/boom');
const config = require('./config');
const fs = require('fs');
const got = require('got');
const path = require('path');
const chalk = require('chalk');
const { format } = require('util');
const pino = require('pino');
const { usePostgresAuthState, DATABASE } = require('./lib/auth');

process.on('uncaughtException', (err) => {
  if (err.message.includes('Bad MAC') || err.message.includes('decrypt message')) {
    return; // ignore these harmless errors
  }
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  if (reason?.message?.includes('Bad MAC') || reason?.message?.includes('decrypt message')) {
    return; // ignore these harmless rejections
  }
  console.error('❌ Unhandled Rejection:', reason);
});

const { PREFIX, VERSION } = require('./config');

async function startBot() {
  try {
    const sessionId = 'xdd_74a50bb39db3a042'; // Change this to your own unique session ID

    const { state, saveCreds } = await usePostgresAuthState(sessionId);
    await config.DATABASE.sync();
    console.log('Syncing...');

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
      },
      printQRInTerminal: false,
      logger: pino({ level: 'error' }),
      browser: ['WhatsApp Bot', 'Safari', '1.0.0'],
    });

    // Save credentials whenever they update
    sock.ev.on('creds.update', saveCreds);

    // Connection updates (QR, open, close)
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrcode.generate(qr, { small: true });
        console.log('Scan the QR code above to connect.');
      }

      if (connection === 'open') {
        // Automatically load all plugins from ./plugins/ folder
        console.log(chalk.blueBright.italic('Loading plugins...'));
        fs.readdirSync('./plugins').forEach((plugin) => {
          if (path.extname(plugin).toLowerCase() === '.js') {
            require(`./plugins/${plugin}`);
          }
        });
        console.log(chalk.blueBright.italic('Plugins loaded'));

        console.log('✅ Connected to WhatsApp!');
        await sock.sendMessage(jidNormalizedUser(sock.user.id), { text: 'Bot Connected ✅' });
      }

      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode;
        console.log('Connection closed, reason:', reason);
        // if not logged out, try to reconnect
        if (reason !== DisconnectReason.loggedOut) {
          console.log('🔄 Reconnecting...');
          startBot();
        } else {
          console.log('❌ Logged out. Remove session data from DB and re-scan QR to log in again.');
        }
      }
    });

    // Handle incoming messages (assuming you have lib/shadow.js for this)
    const { msgUpsert } = require('./lib/shadow');
    sock.ev.on('messages.upsert', async ({ type, messages }) => {
      try {
        await msgUpsert(type, messages, sock);
      } catch (err) {
        if (String(err).includes('Bad MAC') || String(err).includes('No matching sessions')) {
          // Ignore this common libsignal error
        } else {
          console.error('Unexpected error:', err);
        }
      }
    });

    // Handle group updates (assuming you have lib/greetings.js for this)
    const { Greetings } = require('./lib/greetings');
    sock.ev.on('group-participants.update', async (data) => {
      await Greetings(sock, data);
    });

  } catch (err) {
    console.error('Failed to start bot:', err);
  }
}

startBot();
