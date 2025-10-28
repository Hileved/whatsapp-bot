module.exports = {
  PREFIX: '?',
  VERSION: '1.0.0',
  DATABASE: require('./lib/auth').DATABASE // Reuse the DB from auth
};
