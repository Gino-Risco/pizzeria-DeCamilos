module.exports = {
    apps: [
        {
            name: "backend-restmanager",
            script: "src/server.js", 
            cwd: "./backend_3",
            env: {
                NODE_ENV: "development",
                PORT: 4000
            }
        },
        {
            name: "frontend-restmanager",
            script: "server.cjs",
            cwd: "./frontend_3",
            env: {
                NODE_ENV: "production",
                PORT: 5173
            }
        },
        {
            name: "impresora-restmanager",
            script: "server.js",
            cwd: "./microservicio_impresion",
            env: {
                NODE_ENV: "production",
                PORT: 3001,
                BACKEND_URL: "http://localhost:4000"
            }
        }
    ]
};