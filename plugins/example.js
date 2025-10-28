console.log('Example plugin loaded');

// Example: Add a command handler (assuming you have msgUpsert in lib/shadow.js to call this)
module.exports = {
  command: 'ping',
  handler: async (sock, msg) => {
    await sock.sendMessage(msg.key.remoteJid, { text: 'Pong!' });
  }
};
