package helvetia.main;

import helvetia.User;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class UserDaoImpl implements UserDao {

    private final DB db;
    private final Gson gson = new Gson();

    public UserDaoImpl(DB db) {
        this.db = db;
    }

    User fromResultSet(ResultSet rs) throws SQLException {
        String jsonTags = rs.getString("preferTags");
        List<String> tagList = new ArrayList<>();
        if (jsonTags != null && !jsonTags.isEmpty()) {
            tagList = gson.fromJson(jsonTags, new TypeToken<List<String>>(){}.getType());
        }

        long timestampMillis = rs.getLong("timestamp");

        User.Builder builder = User.newBuilder()
                .setId(rs.getLong("id"))
                .setTimestamp(timestampMillis)
                .setUid(nullToEmpty(rs.getString("uid")))
                .setName(nullToEmpty(rs.getString("name")))
                .setGender(nullToEmpty(rs.getString("gender")))
                .setEmail(nullToEmpty(rs.getString("email")))
                .setPhone(nullToEmpty(rs.getString("phone")))
                .setDept(nullToEmpty(rs.getString("dept")))
                .setGrade(nullToEmpty(rs.getString("grade")))
                .setLanguage(nullToEmpty(rs.getString("language")))
                .setRegion(nullToEmpty(rs.getString("region")))
                .setRole(nullToEmpty(rs.getString("role")))
                .addAllPreferTags(tagList)
                .setObtainedCredits(rs.getInt("obtainedCredits"));

        return builder.build();
    }

    /** Convert null to empty string for protobuf string fields */
    private String nullToEmpty(String s) {
        return s == null ? "" : s;
    }

    @Override
    public void create(User u) throws Exception {
        // Vitess sharded tables require the sharding key (id, region) to be provided explicitly
        // AUTO_INCREMENT cannot be used for the primary vindex column in sharded keyspaces
        String sql = """
            INSERT INTO user_keyspace.users (id, timestamp, uid, name, gender, email, phone, dept, grade, language, region, role, preferTags, obtainedCredits)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """;

        try (Connection conn = db.getConnection();
            PreparedStatement st = conn.prepareStatement(sql)) {
            st.setLong(1, u.getId());
            fillStatement(u, st, 2);  // start from parameter index 2
            st.executeUpdate();
        }
    }

    @Override
    public User get(long id) throws Exception {
        String sql = "SELECT id, timestamp, uid, name, gender, email, phone, dept, grade, language, region, role, preferTags, obtainedCredits FROM user_keyspace.users WHERE id = ?";

        try (Connection conn = db.getConnection();
             PreparedStatement st = conn.prepareStatement(sql)) {

            st.setLong(1, id);
            ResultSet rs = st.executeQuery();
            if (!rs.next()) return null;

            return fromResultSet(rs);
        }
    }

    @Override
    public void update(User u) throws Exception {
        String sql = """
            UPDATE user_keyspace.users
            SET name = ?
            WHERE id = ?
        """;

        try (Connection conn = db.getConnection();
             PreparedStatement st = conn.prepareStatement(sql)) {
            st.setString(1, u.getName());
            st.setLong(2, u.getId());
            st.executeUpdate();
        }
    }

    private void fillStatement(User u, PreparedStatement st, int startIdx) throws SQLException {
        int i = startIdx;
        st.setLong(i++, u.getTimestamp());
        st.setString(i++, u.getUid());
        st.setString(i++, u.getName());
        st.setString(i++, emptyToNull(u.getGender()));  // ENUM field - empty string not allowed
        st.setString(i++, emptyToNull(u.getEmail()));
        st.setString(i++, emptyToNull(u.getPhone()));
        st.setString(i++, emptyToNull(u.getDept()));
        st.setString(i++, emptyToNull(u.getGrade()));
        st.setString(i++, emptyToNull(u.getLanguage()));
        st.setString(i++, u.getRegion());
        st.setString(i++, emptyToNull(u.getRole()));
        st.setString(i++, gson.toJson(u.getPreferTagsList()));
        st.setInt(i++, u.getObtainedCredits());
    }

    /** Convert empty strings to null for nullable DB columns */
    private String emptyToNull(String s) {
        return (s == null || s.isEmpty()) ? null : s;
    }

    @Override
    public boolean delete(long id) throws Exception {
        String sql = "DELETE FROM user_keyspace.users WHERE id = ?";

        try (Connection conn = db.getConnection();
             PreparedStatement st = conn.prepareStatement(sql)) {

            st.setLong(1, id);
            return st.executeUpdate() > 0;
        }
    }

    @Override
    public List<User> list() throws Exception {
        String sql = "SELECT id, timestamp, uid, name, gender, email, phone, dept, grade, language, region, role, preferTags, obtainedCredits FROM user_keyspace.users ORDER BY id";

        try (Connection conn = db.getConnection();
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

