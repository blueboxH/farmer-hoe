const application_name = "MAD"
const chalk = require("chalk")
const configs = require("../configuration.json")

const levels_definition = [
    "debug",
    "info",
    "warning",
    "error"
]

let currentLevel = levels_definition.indexOf(configs.log_level)


module.exports = {
    debug() {
        if (0 >= currentLevel) {
            console.log(chalk.green(`[${application_name}] ${new Date().toLocaleString()} `) + chalk.black.bgWhite(` debug `),' ',...Array.from(arguments));
        }

    },
    info() {
        if (1 >= currentLevel) {
            console.log(chalk.green(`[${application_name}] ${new Date().toLocaleString()} `) + chalk.black.bgBlue(` info `),' ',...Array.from(arguments));
        }
    },
    warning() {
        if (2 >= currentLevel) {
            console.log(chalk.green(`[${application_name}] ${new Date().toLocaleString()} `) + chalk.black.bgYellow(` warning `),' ',...Array.from(arguments));
        }
    },
    error() {
        if (3 >= currentLevel) {
            console.log(chalk.green(`[${application_name}] ${new Date().toLocaleString()} `) + chalk.black.bgRed(` error `),' ',...Array.from(arguments));
        }
    }
}