/**
 * Model barrel file — re-exports all models for convenient importing.
 *
 * Instead of:
 *   const User = require('../models/User');
 *   const Repository = require('../models/Repository');
 *
 * You can do:
 *   const { User, Repository } = require('../models');
 */

const User = require('./User');
const Repository = require('./Repository');
const File = require('./File');
const CodeChunk = require('./CodeChunk');
const Conversation = require('./Conversation');
const Message = require('./Message');

module.exports = { User, Repository, File, CodeChunk, Conversation, Message };
