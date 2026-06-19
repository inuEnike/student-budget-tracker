import { app } from "./app";
import { config } from "./shared/config/config";

const PORT = config.PORT;
const startServer = async () => {
  const server = app.listen(PORT, () => {
    console.log("=================================");
    console.log(`Server running on PORT ${PORT}`);
    console.log("=================================");
  });
  server.on("error", (err: Error) => {
    console.log("Server Error:", err.message);
  });
};
startServer();
