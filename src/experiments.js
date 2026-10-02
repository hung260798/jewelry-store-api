const bcrypt = require("bcrypt");
const { log } = require("console");
bcrypt.compare("1","2").then(log).catch(log);
