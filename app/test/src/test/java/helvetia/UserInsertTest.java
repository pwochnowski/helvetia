package helvetia;

import helvetia.User;
import org.junit.*;
import org.junit.runner.RunWith;
import org.testcontainers.Testcontainers;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;
//import org.testcontainers.junit4.Testcontainers;

import static org.junit.Assert.*;

import java.sql.*;


//@RunWith(Testcontainers.class)
public class UserInsertTest {
    static final DockerImageName img =
            DockerImageName.parse("helvetia/postgres:dev")
                    .asCompatibleSubstituteFor("postgres");

    // Start once per test class (recommended for speed)
    @ClassRule
    public static PostgreSQLContainer<?> postgres =
            new PostgreSQLContainer<>(img)
                    .withDatabaseName("helvetia")
                    .withUsername("helvetia")
                    .withPassword("helvetia");
    @Test
    public void insertOneUser() throws Exception {
        String jdbcUrl = postgres.getJdbcUrl();
        String username = postgres.getUsername();
        String password = postgres.getPassword();

        try (Connection conn = DriverManager.getConnection(jdbcUrl, username, password)) {

            // build proto
            User user = User.newBuilder()
                    .setId("u1")
                    .setTimestamp(123456)
                    .setUid("1")
                    .setName("Alice")
                    .setGender("female")
                    .setEmail("alice@example.com")
                    .setPhone("123")
                    .setDept("dept1")
                    .setGrade("grade2")
                    .setLanguage("en")
                    .setRegion("Beijing")
                    .setRole("role1")
                    .setPreferTags("tags3")
                    .setObtainedCredits("42")
                    .build();

            // insert
            PreparedStatement ps = conn.prepareStatement("""
                INSERT INTO users (
                  id, timestamp, uid, name, gender, email, phone,
                  dept, grade, language, region, role, prefer_tags, obtained_credits
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """);

            ps.setString(1, user.getId());
            ps.setLong(2, user.getTimestamp());
            ps.setString(3, user.getUid());
            ps.setString(4, user.getName());
            ps.setString(5, user.getGender());
            ps.setString(6, user.getEmail());
            ps.setString(7, user.getPhone());
            ps.setString(8, user.getDept());
            ps.setString(9, user.getGrade());
            ps.setString(10, user.getLanguage());
            ps.setString(11, user.getRegion());
            ps.setString(12, user.getRole());
            ps.setString(13, user.getPreferTags());
            ps.setString(14, user.getObtainedCredits());
            ps.executeUpdate();

            // verify
            ResultSet rs = conn.createStatement().executeQuery("SELECT COUNT(*) FROM users");
            rs.next();
            assertEquals(1, rs.getInt(1));
        }
    }
}
