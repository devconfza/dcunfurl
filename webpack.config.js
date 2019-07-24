const path = require('path')
const webpack = require('webpack')

module.exports = {
    mode: 'production',
    entry: ['./src/index.ts'],
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    output: {
        filename: './index.js',
    },
    node: {
        console: false,
        process: true,
        fs: 'empty',
        net: 'empty',
        tls: 'empty',
        Buffer: true,
    },
}
