package helvetia.main;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import com.zaxxer.hikari.HikariConfig;
import helvetia.User;
import helvetia.UserList;

import io.prometheus.client.CollectorRegistry;
import io.prometheus.client.Counter;
import io.prometheus.client.Histogram;
import io.prometheus.client.hotspot.DefaultExports;
import io.prometheus.client.exporter.common.TextFormat;

import java.io.StringWriter;

import static spark.Spark.*;

public class Server {
    private final DB db;
    private static final Logger log = LogManager.getLogger(Server.class);

    // Prometheus metrics
    private static final Counter requestsTotal = Counter.build()
            .name("http_requests_total")
            .help("Total HTTP requests")
            .labelNames("method", "endpoint", "status")
            .register();

    private static final Histogram requestDuration = Histogram.build()
            .name("http_request_duration_seconds")
            .help("HTTP request latency in seconds")
            .labelNames("method", "endpoint")
            .register();

    public Server(DB db) {
        this.db = db;
    }


    void addUserEndpoints() {
        UserDao dao = new UserDaoImpl(db);

        // Add a global after-filter to record metrics for all requests
        after((req, res) -> {
            String method = req.requestMethod();
            String path = req.pathInfo();
            String status = String.valueOf(res.status());
            requestsTotal.labels(method, path, status).inc();
        });

        // Add a global before-filter to track request duration
        before((req, res) -> {
            req.attribute("startTime", System.nanoTime());
        });

        after((req, res) -> {
            Long startTime = req.attribute("startTime");
            if (startTime != null) {
                double duration = (System.nanoTime() - startTime) / 1e9;
                requestDuration.labels(req.requestMethod(), req.pathInfo()).observe(duration);
            }
        });

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
            return "";
        });

        delete("/users/:id", (req, res) -> {
            long id = Long.parseLong(req.params(":id"));
            boolean ok = dao.delete(id);
            res.status(ok ? 200 : 404);
            return "";
        });

        get("/users", (req, res) -> {
            final var list = dao.list();
            final var out = UserList.newBuilder().addAllUsers(list).build();
            res.type("application/x-protobuf");
            return out.toByteArray();
        });
    }

    void addMetricsEndpoint() {
        get("/metrics", (req, res) -> {
            res.type(TextFormat.CONTENT_TYPE_004);
            StringWriter writer = new StringWriter();
            TextFormat.write004(writer, CollectorRegistry.defaultRegistry.metricFamilySamples());
            return writer.toString();
        });
    }

    public void run() {
        // Initialize JVM metrics (memory, GC, threads, etc.)
        DefaultExports.initialize();
        
        addUserEndpoints();
        addMetricsEndpoint();
        
        // Add /hello endpoint with metrics tracking
        get("/hello", (req, res) -> "Hello from SparkJava!");
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