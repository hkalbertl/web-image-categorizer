import * as path from 'path';
import { fileURLToPath } from 'url';
import * as webpack from 'webpack';
import CopyWebpackPlugin from "copy-webpack-plugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config: webpack.Configuration = {
  mode: "development", // production
  entry: {
    background: "./src/js/background.ts",
    popup: "./src/js/popup.ts",
    sidebar: "./src/js/sidebar.ts",
    options: "./src/js/options.ts"
  },
  output: {
    filename: "js/[name].js",
    path: path.resolve(__dirname, "build")
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "src",
          to: ".",
          globOptions: {
            ignore: ["**/*.ts"], // Ignore all .ts files
          },
        },
        {
          from: "node_modules/bootstrap/dist/css/bootstrap.min.css",
          to: "lib/bootstrap/bootstrap.min.css",
          info: { minimized: true }
        },
        {
          from: "node_modules/bootstrap/dist/js/bootstrap.bundle.min.js",
          to: "lib/bootstrap/bootstrap.bundle.min.js",
          info: { minimized: true }
        },
        {
          from: "node_modules/bootstrap-icons/font/bootstrap-icons.min.css",
          to: "lib/bootstrap-icons/bootstrap-icons.min.css"
        },
        {
          from: "node_modules/bootstrap-icons/font/fonts",
          to: "lib/bootstrap-icons/fonts"
        }
      ],
    })
  ],
  devtool: "source-map",
  performance: {
    hints: false, // Disable asset size warnings
  }
};
export default config;
