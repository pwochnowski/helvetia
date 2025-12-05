package helvetia.helvetia;

import static spark.Spark.*;

public class Server {
    public static void main(String[] args) {
        port(8080);

        get("/hello", (req, res) -> "Hello from SparkJava!");
    }
}