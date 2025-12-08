package helvetia.main;

import helvetia.User;
import helvetia.dao.UserDao;
import helvetia.dao.UserDaoImpl;

import static spark.Spark.*;

public class Server {
    public static void main(String[] args) {
        port(8080);

        get("/hello", (req, res) -> "Hello from SparkJava!");
    }

    void addUserEndpoints() {
//        UserDao dao = new UserDaoImpl();

        post("/users", (req, res) -> {
            User input = User.parseFrom(req.bodyAsBytes());
            User created = dao.create(input);

            res.type("application/x-protobuf");
            return created.toByteArray();
        });
    }
}