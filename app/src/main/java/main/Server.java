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
import helvetia.BeRead;
import helvetia.BeReadList;
import helvetia.PopularRank;
import helvetia.PopularRankList;

import static spark.Spark.*;

public class Server {
    private final DB db;
    private final RedisCache cache;
    private static final Logger log = LogManager.getLogger(Server.class);


    public Server(DB db) {
        this.db = db;
        this.cache = RedisCache.fromEnv();
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
            
            // Sorting parameters
            String sortBy = req.queryParams("sortBy");
            String sortDir = req.queryParams("sortDir");
            
            // Get total count and list
            final long totalCount = dao.count(filter);
            final var list = dao.list(filter, limit, offset, sortBy, sortDir);

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
            // Invalidate list cache on create
            cache.deletePattern(RedisCache.ARTICLE_LIST_PREFIX + "*");
            return "";
        });

        get("/articles/:id", (req, res) -> {
            long id = Long.parseLong(req.params(":id"));
            String cacheKey = RedisCache.articleKey(id);
            
            // Try cache first
            byte[] cached = cache.get(cacheKey);
            if (cached != null) {
                res.type("application/x-protobuf");
                return cached;
            }
            
            // Cache miss - fetch from database
            Article a = dao.get(id);
            if (a == null) halt(404);

            byte[] bytes = a.toByteArray();
            cache.set(cacheKey, bytes);
            
            res.type("application/x-protobuf");
            return bytes;
        });

        put("/articles/:id", (req, res) -> {
            Article input = Article.parseFrom(req.bodyAsBytes());
            dao.update(input);
            // Invalidate caches on update
            cache.delete(RedisCache.articleKey(input.getId()));
            cache.deletePattern(RedisCache.ARTICLE_LIST_PREFIX + "*");
            return "";
        });

        delete("/articles/:id", (req, res) -> {
            long id = Long.parseLong(req.params(":id"));
            boolean ok = dao.delete(id);
            // Invalidate caches on delete
            cache.delete(RedisCache.articleKey(id));
            cache.deletePattern(RedisCache.ARTICLE_LIST_PREFIX + "*");
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
            
            // Sorting parameters
            String sortBy = req.queryParams("sortBy");
            String sortDir = req.queryParams("sortDir");
            
            // Generate cache key for this query
            String cacheKey = RedisCache.articleListKey(filter, limit, offset, sortBy, sortDir);
            
            // Try cache first
            byte[] cached = cache.get(cacheKey);
            if (cached != null) {
                res.type("application/x-protobuf");
                return cached;
            }
            
            // Cache miss - fetch from database
            final long totalCount = dao.count(filter);
            final var list = dao.list(filter, limit, offset, sortBy, sortDir);

            final var out = ArticleList.newBuilder()
                .addAllArticles(list)
                .setTotalCount(totalCount)
                .build();
            
            byte[] bytes = out.toByteArray();
            cache.set(cacheKey, bytes);
            
            res.type("application/x-protobuf");
            return bytes;
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
            
            // Sorting parameters
            String sortBy = req.queryParams("sortBy");
            String sortDir = req.queryParams("sortDir");
            
            // Get total count and list
            final long totalCount = dao.count(filter);
            final var list = dao.list(filter, limit, offset, sortBy, sortDir);

            final var out = ReadList.newBuilder()
                .addAllReads(list)
                .setTotalCount(totalCount)
                .build();
            res.type("application/x-protobuf");
            return out.toByteArray();
        });
    }

    void addBeReadEndpoints() {
        BeReadDao dao = new BeReadDaoImpl(db);

        post("/bereads", (req, res) -> {
            BeRead input = BeRead.parseFrom(req.bodyAsBytes());
            dao.create(input);

            return "";
        });

        get("/bereads/:id", (req, res) -> {
            long id = Long.parseLong(req.params(":id"));
            BeRead b = dao.get(id);
            if (b == null) halt(404);

            res.type("application/x-protobuf");
            return b.toByteArray();
        });

        put("/bereads/:id", (req, res) -> {
            BeRead input = BeRead.parseFrom(req.bodyAsBytes());
            dao.update(input);
            return "";
        });

        delete("/bereads/:id", (req, res) -> {
            long id = Long.parseLong(req.params(":id"));
            boolean ok = dao.delete(id);

            res.status(ok ? 200 : 404);
            return "";
        });

        get("/bereads", (req, res) -> {
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
            
            // Sorting parameters
            String sortBy = req.queryParams("sortBy");
            String sortDir = req.queryParams("sortDir");
            
            // Get total count and list
            final long totalCount = dao.count(filter);
            final var list = dao.list(filter, limit, offset, sortBy, sortDir);

            final var out = BeReadList.newBuilder()
                .addAllBereads(list)
                .setTotalCount(totalCount)
                .build();
            res.type("application/x-protobuf");
            return out.toByteArray();
        });
    }

    void addPopularRankEndpoints() {
        PopularRankDao dao = new PopularRankDaoImpl(db);

        post("/popularranks", (req, res) -> {
            PopularRank input = PopularRank.parseFrom(req.bodyAsBytes());
            dao.create(input);

            return "";
        });

        get("/popularranks/:id", (req, res) -> {
            long id = Long.parseLong(req.params(":id"));
            PopularRank p = dao.get(id);
            if (p == null) halt(404);

            res.type("application/x-protobuf");
            return p.toByteArray();
        });

        put("/popularranks/:id", (req, res) -> {
            PopularRank input = PopularRank.parseFrom(req.bodyAsBytes());
            dao.update(input);
            return "";
        });

        delete("/popularranks/:id", (req, res) -> {
            long id = Long.parseLong(req.params(":id"));
            boolean ok = dao.delete(id);

            res.status(ok ? 200 : 404);
            return "";
        });

        get("/popularranks", (req, res) -> {
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
            
            // Sorting parameters
            String sortBy = req.queryParams("sortBy");
            String sortDir = req.queryParams("sortDir");
            
            // Get total count and list
            final long totalCount = dao.count(filter);
            final var list = dao.list(filter, limit, offset, sortBy, sortDir);

            final var out = PopularRankList.newBuilder()
                .addAllPopularRanks(list)
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
        addBeReadEndpoints();
        addPopularRankEndpoints();
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

        // Read server port from environment, fallback to 8080
        int serverPort = Integer.parseInt(System.getenv().getOrDefault(
                "PORT",
                "8080"
        ));

        HikariConfig cfg = new HikariConfig();
        cfg.setJdbcUrl(dbUrl);
        cfg.setUsername(dbUser);
        cfg.setPassword(dbPass);
        DB db = new DB(cfg, "user_keyspace");

        Server server = new Server(db);
        ipAddress(bindAddr);
        port(serverPort);

        get("/hello", (req, res) -> "Hello from SparkJava!");

        server.run();
    }
}