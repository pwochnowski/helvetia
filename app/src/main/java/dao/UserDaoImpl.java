package helvetia.dao;

import helvetia.User;

import javax.sql.DataSource;
import java.sql.*;
        import java.util.ArrayList;
import java.util.List;

public class UserDaoImpl implements UserDao {

    private final DataSource ds;

    public UserDaoImpl(DataSource ds) {
        this.ds = ds;
    }

    User fromResultSet(ResultSet rs) throws SQLException {
        return User.newBuilder()
                .setId(rs.getString("id"))
                .setTimestamp(rs.getLong("ts"))
                .setUid(rs.getString("uid"))
                .setName(rs.getString("name"))
//                .setGender(rs.getString("gender"))
//                .setEmail(rs.getString("email"))
//                .setPhone(rs.getString("phone"))
//                .setDept(rs.getString("dept"))
//                .setGrade(rs.getString("grade"))
//                .setLanguage(rs.getString("language"))
//                .setRegion(rs.getString("region"))
//                .setRole(rs.getString("role"))
//                .setPreferTags(rs.getString("prefer_tags"))
//                .setObtainedCredits(rs.getString("obtained_credits"))
                .build();
    }

    @Override
    public void create(User u) throws Exception {
        String sql = """
            INSERT INTO users (id, ts, uid, name)
            VALUES (?, ?, ?, ?)
        """;

        try (Connection conn = ds.getConnection();
            PreparedStatement st = conn.prepareStatement(sql)) {
            fillStatement(u, st);
            st.executeUpdate();
        }
    }

    @Override
    public User get(long id) throws Exception {
        String sql = "SELECT id, ts, uid, name FROM users WHERE id = ?";

        try (Connection conn = ds.getConnection();
             PreparedStatement st = conn.prepareStatement(sql)) {

            st.setString(1, String.valueOf(id));
            ResultSet rs = st.executeQuery();
            if (!rs.next()) return null;

            return fromResultSet(rs);
        }
    }

    @Override
    public void update(User u) throws Exception {
        String sql = """
            UPDATE users
            SET name = ?
            WHERE id = ?
        """;

        try (Connection conn = ds.getConnection();
             PreparedStatement st = conn.prepareStatement(sql)) {
            st.setString(1, u.getName());
            st.setString(2, u.getId());
            st.executeUpdate();
        }
    }

    private void fillStatement(User u, PreparedStatement st) throws SQLException {
        st.setString(1, u.getId());
        st.setLong(2, u.getTimestamp());
        st.setString(3, u.getUid());
        st.setString(4, u.getName());
//        st.setString(5, u.getGender());
//        st.setString(6, u.getEmail());
//        st.setString(7, u.getPhone());
//        st.setString(8, u.getDept());
//        st.setString(9, u.getGrade());
//        st.setString(10, u.getLanguage());
//        st.setString(11, u.getRegion());
//        st.setString(12, u.getRole());
//        st.setString(13, u.getPreferTags());
//        st.setString(14, u.getObtainedCredits());
    }

    @Override
    public boolean delete(long id) throws Exception {
        String sql = "DELETE FROM users WHERE id = ?";

        try (Connection conn = ds.getConnection();
             PreparedStatement st = conn.prepareStatement(sql)) {

            st.setString(1, String.valueOf(id));
            return st.executeUpdate() > 0;
        }
    }

    @Override
    public List<User> list() throws Exception {
        String sql = "SELECT id, ts, uid, name FROM users ORDER BY id";

        try (Connection conn = ds.getConnection();
             PreparedStatement st = conn.prepareStatement(sql)) {

            ResultSet rs = st.executeQuery();
            List<User> out = new ArrayList<>();

            while (rs.next()) {
                out.add(fromResultSet(rs));
            }

            return out;
        }
    }
}

