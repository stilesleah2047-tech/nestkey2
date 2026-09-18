const config = require('../config');

// Swap the whole data layer with one env var: DB_DRIVER=mongo | postgres
const driver = config.driver === 'mongo'
  ? require('./mongo')
  : require('./postgres');

module.exports = driver;
