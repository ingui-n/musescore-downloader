const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlPlugin = require('html-webpack-plugin');
const {CleanWebpackPlugin} = require('clean-webpack-plugin');

module.exports = {
  entry: {
    popup: path.resolve('src/popup/index.jsx'),
    background: path.resolve('src/background/background.js'),
    content: path.resolve('src/content/content.js'),
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [
          {
            loader: 'style-loader',
          },
          {
            loader: 'css-loader',
            options: {
              importLoaders: 1,
            }
          }
        ],
      },
      {
        test: /\.(png|jpg|jpeg|gif|woff|woff2|tff|eot|svg)$/,
        type: 'asset/resource',
        exclude: /node_modules/,
      },
      {
        test: /\.(js|jsx)$/,
        use: [
          {
            loader: 'source-map-loader',
          },
          {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env', '@babel/preset-react']
            }
          },
        ],
        exclude: /node_modules/,
      },
    ]
  },
  plugins: [
    new CleanWebpackPlugin({ verbose: false }),
    new CopyPlugin({
      patterns: [{
        from: path.resolve('src/manifest.json'),
        to: path.resolve('dist'),
        transform: content => {
          return Buffer.from(
            JSON.stringify({
              description: process.env.npm_package_description,
              version: process.env.npm_package_version,
              ...JSON.parse(content.toString())
            })
          );
        }
      }]
    }),
    new CopyPlugin({
      patterns: [
        {
          from: 'src/assets/img',
          to: path.join(__dirname, 'dist'),
          force: true,
        },
      ],
    }),
    new HtmlPlugin({
      template: path.join(__dirname, 'src/popup/index.html'),
      filename: 'popup.html',
      chunks: ['popup'],
      cache: false,
    }),
  ],
  experiments: {
    topLevelAwait: true
  },
  resolve: {
    extensions: ['.js']
  },
  output: {
    filename: '[name].js',
    path: path.join(__dirname, 'dist'),
    clean: true,
  },
  devtool: false
};
