package helvetia.main;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import javax.sql.DataSource;

public class DB {
    private final HikariDataSource ds;

    public DB(HikariConfig cfg) {
        this.ds = new HikariDataSource(cfg);
    }

    public DataSource get() { return ds; }
}

