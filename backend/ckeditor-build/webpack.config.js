// webpack.config.js
const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  mode: 'production',
  entry: path.resolve(__dirname, 'src', 'ckeditor.js'),
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'ckeditor.js',
    library: 'ClassicEditor',
    libraryTarget: 'umd',
    globalObject: 'this'
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [ MiniCssExtractPlugin.loader, 'css-loader' ]
      },
      {
        test: /\.(svg|png|jpg|gif)$/,
        use: [ { loader: 'file-loader', options: { esModule: false } } ]
      }
    ]
  },
  plugins: [
    new MiniCssExtractPlugin({ filename: 'ckeditor.css' })
  ]
};
