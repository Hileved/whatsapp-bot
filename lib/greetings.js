async function Greetings(sock, data) {
  // Example: Welcome new group members
  if (data.action === 'add') {
    await sock.sendMessage(data.id, { text: 'Welcome!' });
  }
}

module.exports = { Greetings };
