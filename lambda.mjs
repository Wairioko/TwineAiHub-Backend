import serverless from 'aws-serverless-express'
import app from "./index.mjs"

const server = serverless.createServer(app)

exports.handler = (event, context) => {
    return serverless.proxy(server, event, context);
    
}