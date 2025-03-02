const path = require("path");
const HTMLPlugin = require("html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin")
const MiniCssExtractPlugin = require("mini-css-extract-plugin"); // Add this

module.exports = {
    entry: {
        index: "./src/index.tsx",
        contentScript: "../scripts/contentScript.ts",
        background: "../scripts/background.ts"
    },
    mode: "production",
    module: {
        rules: [
            {
              test: /\.tsx?$/,
               use: [
                 {
                  loader: "ts-loader",
                   options: {
                     compilerOptions: { noEmit: false },
                    }
                  }],
               exclude: /node_modules/,
            },
            {
                test: /\.svg$/,
                use: [
                {
                    loader: 'svg-url-loader',
                    options: {
                        limit: 10 * 1024, // inline files smaller than 10kb as base64 URLs
                        noquotes: true,
                    },
                },
                ],
            },
            {
                test: /\.css$/i,  // Target CSS files
                include: path.resolve(__dirname, 'src'),
                use: [
                    MiniCssExtractPlugin.loader,   // Inject CSS into the DOM
                    'css-loader',     // Loads CSS file as a module (required for PostCSS)
                    'postcss-loader',
                ],
            },
        ],
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                { from: "manifest.json", to: "../manifest.json" },
                { from: "public/icons", to: "../icons"}
            ],
        }),
        new MiniCssExtractPlugin({
            filename: "[name].css", // Output CSS files to a `css` subdirectory
        }),
        ...getHtmlPlugins(["index"]),
    ],
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
    },
    output: {
        path: path.join(__dirname, "dist/js"),
        filename: "[name].bundle.js",
    },
};

function getHtmlPlugins(chunks) {
    return chunks.map(
        (chunk) =>
            new HTMLPlugin({
                title: "React extension",
                filename: `${chunk}.html`,
                template: path.resolve(__dirname, 'public', 'index.html'), // Use the HTML file in /public
                chunks: [chunk],
            })
    );
}