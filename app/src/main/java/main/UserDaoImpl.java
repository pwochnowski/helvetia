package helvetia.main;

import helvetia.User;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

public class UserDaoImpl implements UserDao {

    private final DB db;
    private final Gson gson = new Gson();
    
    // RSQL to SQL converter with allowed columns
    private final RsqlToSql rsqlConverter = new RsqlToSql(Set.of(
        "id", "timestamp", "uid", "name", "gender", "email", "phone",
        "dept", "grade", "language", "region", "role", "obtainedCredits"
    ));

    public UserDaoImpl(DB db) {
        this.db = db;
    }

    User fromResultSet(ResultSet rs) throws SQLException {
        String jsonTags = rs.getString("preferTags");
        List<String> tagList = new ArrayList<>();
        if (jsonTags != null && !jsonTags.isEmpty()) {
            tagList = gson.fromJson(jsonTags, new TypeToken<List<String>>(){}.getType());
        }

        Timestamp ts = rs.getTimestamp("timestamp");
        long timestampMillis = ts != null ? ts.getTime() : 0;

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
            INSERT INTO user_keyspace.user (id, timestamp, uid, name, gender, email, phone, dept, grade, language, region, role, preferTags, obtainedCredits)
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
        String sql = "SELECT id, timestamp, uid, name, gender, email, phone, dept, grade, language, region, role, preferTags, obtainedCredits FROM user_keyspace.user WHERE id = ?";

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
            UPDATE user_keyspace.user
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
        st.setTimestamp(i++, new Timestamp(u.getTimestamp()));
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
        String sql = "DELETE FROM user_keyspace.user WHERE id = ?";

        try (Connection conn = db.getConnection();
             PreparedStatement st = conn.prepareStatement(sql)) {

            st.setLong(1, id);
            return st.executeUpdate() > 0;
        }
    }

    @Override
    public List<User> list() throws Exception {
        return list(null);
    }
    
    @Override
    public List<User> list(String rsqlFilter) throws Exception {
        return list(rsqlFilter, 10000, 0);
    }
    
    @Override
    public List<User> list(String rsqlFilter, int limit, int offset) throws Exception {
        // Base query
        String baseSql = "SELECT id, timestamp, uid, name, gender, email, phone, dept, grade, language, region, role, preferTags, obtainedCredits FROM user_keyspace.user";
        
        // Convert RSQL to SQL WHERE clause
        RsqlToSql.SqlResult filterResult = rsqlConverter.convert(rsqlFilter);
        
        // Build final query with offset-based pagination
        String sql = baseSql + " WHERE " + filterResult.whereClause + " ORDER BY id LIMIT ? OFFSET ?";

        try (Connection conn = db.getConnection();
             PreparedStatement st = conn.prepareStatement(sql)) {

            // Set parameters from RSQL conversion
            int paramIndex = 1;
            for (Object param : filterResult.parameters) {
                if (param instanceof Long) {
                    st.setLong(paramIndex, (Long) param);
                } else if (param instanceof Double) {
                    st.setDouble(paramIndex, (Double) param);
                } else if (param instanceof Integer) {
                    st.setInt(paramIndex, (Integer) param);
                } else {
                    st.setString(paramIndex, param.toString());
                }
                paramIndex++;
            }
            
            // Set limit and offset parameters
            st.setInt(paramIndex++, limit);
            st.setInt(paramIndex, offset);

            ResultSet rs = st.executeQuery();
            List<User> out = new ArrayList<>();

            while (rs.next()) {
                out.add(fromResultSet(rs));
            }

            return out;
        }
    }
    
    @Override
    public long count(String rsqlFilter) throws Exception {
        String baseSql = "SELECT COUNT(*) FROM user_keyspace.user";
        
        // Convert RSQL to SQL WHERE clause
        RsqlToSql.SqlResult filterResult = rsqlConverter.convert(rsqlFilter);
        
        String sql = baseSql + " WHERE " + filterResult.whereClause;

        try (Connection conn = db.getConnection();
             PreparedStatement st = conn.prepareStatement(sql)) {

            // Set parameters from RSQL conversion
            int paramIndex = 1;
            for (Object param : filterResult.parameters) {
                if (param instanceof Long) {
                    st.setLong(paramIndex, (Long) param);
                } else if (param instanceof Double) {
                    st.setDouble(paramIndex, (Double) param);
                } else if (param instanceof Integer) {
                    st.setInt(paramIndex, (Integer) param);
                } else {
                    st.setString(paramIndex, param.toString());
                }
                paramIndex++;
            }

            ResultSet rs = st.executeQuery();
            if (rs.next()) {
                return rs.getLong(1);
            }
            return 0;
        }
    }
}

