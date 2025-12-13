package helvetia.main;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

public class DB {
    private final HikariDataSource ds;
    private final String keyspace;

    public DB(HikariConfig cfg, String keyspace) {
        this.ds = new HikariDataSource(cfg);
        this.keyspace = keyspace;
    }

    public Connection getConnection() throws SQLException {
        Connection conn = ds.getConnection();
        if (keyspace != null && !keyspace.isEmpty()) {
            try (Statement st = conn.createStatement()) {
                st.execute("USE " + keyspace);
            }
        }
        return conn;
    }
}

