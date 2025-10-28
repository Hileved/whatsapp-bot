async function msgUpsert(type, messages, sock) {
  if (type !== 'notify') return;
  const msg = messages[0];
  if (!msg.message) return;

  // Example: Parse message and call plugin handlers
  const text = msg.message.conversation || '';
  if (text.startsWith(require('../config').PREFIX)) {
    const command = text.slice(1).trim();
    // Load and call matching plugins (you can expand this)
    console.log(`Command received: ${command}`);
    // For example, if plugins export {command, handler}, call handler here
  }
}

module.exports = { msgUpsert };
