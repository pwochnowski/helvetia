package helvetia;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import helvetia.dao.UserDao;
import helvetia.dao.UserDaoImpl;
import org.junit.Assert;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.utility.DockerImageName;

public class UserDaoTest {

    static MySQLContainer<?> myqsl;
    static UserDao dao;

    @BeforeClass
    public static void setup() throws Exception {
        //noinspection resource
        myqsl = new MySQLContainer<>(
                DockerImageName.parse("helvetia/mysql:dev")
                        .asCompatibleSubstituteFor("mysql"))
                .withDatabaseName("helvetia")
                .withUsername("helvetia")
                .withPassword("helvetia");
        myqsl.start();

        HikariConfig cfg = new HikariConfig();
        cfg.setJdbcUrl(myqsl.getJdbcUrl());
        cfg.setUsername(myqsl.getUsername());
        cfg.setPassword(myqsl.getPassword());
        dao = new UserDaoImpl(new HikariDataSource(cfg));
    }

    @AfterClass
    public static void teardown() { myqsl.stop(); }

    @Test
    public void fullWorkflow() throws Exception {
        // insert
        User u1 = User.newBuilder()
                .setId("1").setTimestamp(1).setUid("u1").setName("Alice").setRegion("beijing")
                .build();
        dao.create(u1);
//        Assert.assertEquals(u1.getName(), created1.getName());

        // get
        User got = dao.get(1);
        Assert.assertEquals(u1.getName(), got.getName());

        // update
        dao.update(got.toBuilder().setName("Alice2").build());
        User updated = dao.get(1);
        Assert.assertEquals("Alice2", updated.getName());

        // another insert
        User u2 = User.newBuilder()
                .setId("2").setTimestamp(2).setUid("u2").setName("Bob")
                .build();
        dao.create(u2);

        // list
        var list = dao.list();
        Assert.assertEquals(2, list.size());

        // delete
        boolean deleted = dao.delete(1);
        Assert.assertTrue(deleted);
    }
}

