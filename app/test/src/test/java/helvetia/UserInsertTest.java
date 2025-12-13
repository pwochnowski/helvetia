package helvetia;

import org.junit.ClassRule;
import org.junit.Test;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.utility.DockerImageName;
//import org.testcontainers.junit4.Testcontainers;

import static org.junit.Assert.*;

import java.sql.*;


//@RunWith(Testcontainers.class)
public class UserInsertTest {
    static final DockerImageName img =
            DockerImageName.parse("helvetia/mysql:dev")
                    .asCompatibleSubstituteFor("mysql");

    // Start once per test class (recommended for speed)
    @ClassRule
    public static MySQLContainer<?> mysql =
            new MySQLContainer<>(img)
                    .withDatabaseName("helvetia")
                    .withUsername("helvetia")
                    .withPassword("helvetia");
    @Test
    public void insertOneUser() throws Exception {
        String jdbcUrl = mysql.getJdbcUrl();
        String username = mysql.getUsername();
        String password = mysql.getPassword();

        try (Connection conn = DriverManager.getConnection(jdbcUrl, username, password)) {

            // build proto
            User user = User.newBuilder()
                    .setId("u1")
                    .setTimestamp(123456)
                    .setUid("1")
                    .setName("Alice")
                    .setRegion("beijing")
                    .build();

            // insert
            PreparedStatement ps = conn.prepareStatement("""
                INSERT INTO users (
                  id, ts, uid, name, region
                ) VALUES (?, ?, ?, ?, ?)
            """);

            ps.setString(1, user.getId());
            ps.setLong(2, user.getTimestamp());
            ps.setString(3, user.getUid());
            ps.setString(4, user.getName());
            ps.setString(5, user.getRegion());
            ps.executeUpdate();

            // verify
            ResultSet rs = conn.createStatement().executeQuery("SELECT COUNT(*) FROM users");
            rs.next();
            assertEquals(1, rs.getInt(1));
        }
    }
}
