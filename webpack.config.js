const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: ['./index.js'],

  node: {
    console: false,
    process: true,
    fs: 'empty',
    net: 'empty',
    tls: 'empty',
    Buffer: true
  },
}