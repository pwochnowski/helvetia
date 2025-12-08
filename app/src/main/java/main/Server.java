package helvetia.main;

import com.zaxxer.hikari.HikariConfig;
import helvetia.User;
import helvetia.UserList;
import helvetia.dao.UserDao;
import helvetia.dao.UserDaoImpl;

import static spark.Spark.*;

public class Server {
    private final DB db;

    public Server(DB db) {
        this.db = db;
    }


    void addUserEndpoints() {
        UserDao dao = new UserDaoImpl(db.get());

        post("/users", (req, res) -> {
            User input = User.parseFrom(req.bodyAsBytes());
            User created = dao.create(input);

            res.type("application/x-protobuf");
            return created.toByteArray();
        });

        get("/users/:id", (req, res) -> {
            long id = Long.parseLong(req.params(":id"));
            User u = dao.get(id);
            if (u == null) halt(404);

            res.type("application/x-protobuf");
            return u.toByteArray();
        });

        put("/users/:id", (req, res) -> {
            User input = User.parseFrom(req.bodyAsBytes());
            User updated = dao.update(input);
            if (updated == null) halt(404);

            res.type("application/x-protobuf");
            return updated.toByteArray();
        });

        delete("/users/:id", (req, res) -> {
            long id = Long.parseLong(req.params(":id"));
            boolean ok = dao.delete(id);

            res.status(ok ? 200 : 404);
            return "";
        });

        get("/users", (req, res) -> {
            final var list = dao.list();  // List<User>

            final var out = UserList.newBuilder().addAllUsers(list).build();
            res.type("application/x-protobuf");
            return out.toByteArray();
        });
    }

    public void run() {
        addUserEndpoints();
    }

    public static void main(String[] args) {
        // Read DB URL from environment, fallback to local default
        String dbUrl = System.getenv().getOrDefault(
                "DB_URL",
                "jdbc:postgresql://localhost:5432/helvetia"
        );
        String dbUser = System.getenv().getOrDefault(
                "DB_USER",
                "helvetia"
        );
        String dbPass = System.getenv().getOrDefault(
                "DB_PASS",
                "helvetia"
        );

        // Read server bind address from environment, fallback to localhost
        String bindAddr = System.getenv().getOrDefault(
                "BIND_ADDR",
                "localhost"
        );

        HikariConfig cfg = new HikariConfig();
        cfg.setJdbcUrl(dbUrl);
        cfg.setUsername(dbUser);
        cfg.setPassword(dbPass);
        DB db = new DB(cfg);

        Server server = new Server(db);
        ipAddress(bindAddr);
        port(8080);

        get("/hello", (req, res) -> "Hello from SparkJava!");

        server.run();
    }
}