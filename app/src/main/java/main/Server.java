package helvetia.main;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import com.zaxxer.hikari.HikariConfig;
import helvetia.User;
import helvetia.UserList;
import helvetia.Article;
import helvetia.ArticleList;
import helvetia.Read;
import helvetia.ReadList;

import static spark.Spark.*;

public class Server {
    private final DB db;
    private static final Logger log = LogManager.getLogger(Server.class);


    public Server(DB db) {
        this.db = db;
    }


    void addUserEndpoints() {
        UserDao dao = new UserDaoImpl(db);

        post("/users", (req, res) -> {
            User input = User.parseFrom(req.bodyAsBytes());
            dao.create(input);

            return "";
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
            dao.update(input);
//            if (updated == null) halt(404);
            return "";
        });

        delete("/users/:id", (req, res) -> {
            long id = Long.parseLong(req.params(":id"));
            boolean ok = dao.delete(id);

            res.status(ok ? 200 : 404);
            return "";
        });

        get("/users", (req, res) -> {
            // Get optional RSQL filter from query parameter
            String filter = req.queryParams("filter");
            
            // Pagination parameters
            int limit = 100;
            String limitParam = req.queryParams("limit");
            if (limitParam != null) {
                limit = Math.min(Integer.parseInt(limitParam), 10000);
            }
            
            int offset = 0;
            String offsetParam = req.queryParams("offset");
            if (offsetParam != null) {
                offset = Integer.parseInt(offsetParam);
            }
            
            // Get total count and list in parallel (same filter)
            final long totalCount = dao.count(filter);
            final var list = dao.list(filter, limit, offset);

            final var out = UserList.newBuilder()
                .addAllUsers(list)
                .setTotalCount(totalCount)
                .build();
            res.type("application/x-protobuf");
            return out.toByteArray();
        });
    }

    void addArticleEndpoints() {
        ArticleDao dao = new ArticleDaoImpl(db);

        post("/articles", (req, res) -> {
            Article input = Article.parseFrom(req.bodyAsBytes());
            dao.create(input);

            return "";
        });

        get("/articles/:id", (req, res) -> {
            long id = Long.parseLong(req.params(":id"));
            Article a = dao.get(id);
            if (a == null) halt(404);

            res.type("application/x-protobuf");
            return a.toByteArray();
        });

        put("/articles/:id", (req, res) -> {
            Article input = Article.parseFrom(req.bodyAsBytes());
            dao.update(input);
            return "";
        });

        delete("/articles/:id", (req, res) -> {
            long id = Long.parseLong(req.params(":id"));
            boolean ok = dao.delete(id);

            res.status(ok ? 200 : 404);
            return "";
        });

        get("/articles", (req, res) -> {
            String filter = req.queryParams("filter");
            
            // Pagination parameters
            int limit = 100;
            String limitParam = req.queryParams("limit");
            if (limitParam != null) {
                limit = Math.min(Integer.parseInt(limitParam), 10000);
            }
            
            int offset = 0;
            String offsetParam = req.queryParams("offset");
            if (offsetParam != null) {
                offset = Integer.parseInt(offsetParam);
            }
            
            // Get total count and list
            final long totalCount = dao.count(filter);
            final var list = dao.list(filter, limit, offset);

            final var out = ArticleList.newBuilder()
                .addAllArticles(list)
                .setTotalCount(totalCount)
                .build();
            res.type("application/x-protobuf");
            return out.toByteArray();
        });
    }

    void addReadEndpoints() {
        ReadDao dao = new ReadDaoImpl(db);

        post("/reads", (req, res) -> {
            Read input = Read.parseFrom(req.bodyAsBytes());
            dao.create(input);

            return "";
        });

        get("/reads/:id", (req, res) -> {
            long id = Long.parseLong(req.params(":id"));
            Read r = dao.get(id);
            if (r == null) halt(404);

            res.type("application/x-protobuf");
            return r.toByteArray();
        });

        put("/reads/:id", (req, res) -> {
            Read input = Read.parseFrom(req.bodyAsBytes());
            dao.update(input);
            return "";
        });

        delete("/reads/:id", (req, res) -> {
            long id = Long.parseLong(req.params(":id"));
            boolean ok = dao.delete(id);

            res.status(ok ? 200 : 404);
            return "";
        });

        get("/reads", (req, res) -> {
            String filter = req.queryParams("filter");
            
            // Pagination parameters
            int limit = 100;
            String limitParam = req.queryParams("limit");
            if (limitParam != null) {
                limit = Math.min(Integer.parseInt(limitParam), 10000);
            }
            
            int offset = 0;
            String offsetParam = req.queryParams("offset");
            if (offsetParam != null) {
                offset = Integer.parseInt(offsetParam);
            }
            
            // Get total count and list
            final long totalCount = dao.count(filter);
            final var list = dao.list(filter, limit, offset);

            final var out = ReadList.newBuilder()
                .addAllReads(list)
                .setTotalCount(totalCount)
                .build();
            res.type("application/x-protobuf");
            return out.toByteArray();
        });
    }

    public void run() {
        addUserEndpoints();
        addArticleEndpoints();
        addReadEndpoints();
    }

    public static void main(String[] args) {
        // Read DB URL from environment, fallback to Vitess local default
        // Connect to Vitess vtgate - empty database, will use fully qualified table names
        String dbUrl = System.getenv().getOrDefault(
                "DB_URL",
                "jdbc:mysql://127.0.0.1:15306/"
        );
        String dbUser = System.getenv().getOrDefault(
                "DB_USER",
                "root"
        );
        String dbPass = System.getenv().getOrDefault(
                "DB_PASS",
                ""
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
        DB db = new DB(cfg, "user_keyspace");

        Server server = new Server(db);
        ipAddress(bindAddr);
        port(8080);

        get("/hello", (req, res) -> "Hello from SparkJava!");

        server.run();
    }
}