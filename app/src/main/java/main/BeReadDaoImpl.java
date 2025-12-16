package helvetia.main;

import helvetia.BeRead;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

public class BeReadDaoImpl implements BeReadDao {

    private final DB db;
    private final Gson gson = new Gson();
    
    // RSQL to SQL converter with allowed columns
    private final RsqlToSql rsqlConverter = new RsqlToSql(Set.of(
        "id", "timestamp", "aid", "category", "readNum", "commentNum", "agreeNum", "shareNum"
    ));

    public BeReadDaoImpl(DB db) {
        this.db = db;
    }

    BeRead fromResultSet(ResultSet rs) throws SQLException {
        String jsonReadUidList = rs.getString("readUidList");
        List<String> readUidList = new ArrayList<>();
        if (jsonReadUidList != null && !jsonReadUidList.isEmpty()) {
            readUidList = gson.fromJson(jsonReadUidList, new TypeToken<List<String>>(){}.getType());
        }
        
        String jsonCommentUidList = rs.getString("commentUidList");
        List<String> commentUidList = new ArrayList<>();
        if (jsonCommentUidList != null && !jsonCommentUidList.isEmpty()) {
            commentUidList = gson.fromJson(jsonCommentUidList, new TypeToken<List<String>>(){}.getType());
        }
        
        String jsonAgreeUidList = rs.getString("agreeUidList");
        List<String> agreeUidList = new ArrayList<>();
        if (jsonAgreeUidList != null && !jsonAgreeUidList.isEmpty()) {
            agreeUidList = gson.fromJson(jsonAgreeUidList, new TypeToken<List<String>>(){}.getType());
        }
        
        String jsonShareUidList = rs.getString("shareUidList");
        List<String> shareUidList = new ArrayList<>();
        if (jsonShareUidList != null && !jsonShareUidList.isEmpty()) {
            shareUidList = gson.fromJson(jsonShareUidList, new TypeToken<List<String>>(){}.getType());
        }

        Timestamp ts = rs.getTimestamp("timestamp");
        long timestampMillis = ts != null ? ts.getTime() : 0;

        return BeRead.newBuilder()
                .setId(rs.getLong("id"))
                .setTimestamp(timestampMillis)
                .setAid(nullToEmpty(rs.getString("aid")))
                .setCategory(nullToEmpty(rs.getString("category")))
                .setReadNum(rs.getInt("readNum"))
                .addAllReadUidList(readUidList)
                .setCommentNum(rs.getInt("commentNum"))
                .addAllCommentUidList(commentUidList)
                .setAgreeNum(rs.getInt("agreeNum"))
                .addAllAgreeUidList(agreeUidList)
                .setShareNum(rs.getInt("shareNum"))
                .addAllShareUidList(shareUidList)
                .build();
    }

    /** Convert null to empty string for protobuf string fields */
    private String nullToEmpty(String s) {
        return s == null ? "" : s;
    }

    @Override
    public void create(BeRead b) throws Exception {
        String sql = """
            INSERT INTO beread_keyspace.beread (id, aid, category, readNum, readUidList, commentNum, commentUidList, agreeNum, agreeUidList, shareNum, shareUidList)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """;

        try (Connection conn = db.getConnection();
            PreparedStatement st = conn.prepareStatement(sql)) {
            st.setLong(1, b.getId());
            fillStatement(b, st, 2);
            st.executeUpdate();
        }
    }

    @Override
    public BeRead get(long id) throws Exception {
        String sql = "SELECT id, timestamp, aid, category, readNum, readUidList, commentNum, commentUidList, agreeNum, agreeUidList, shareNum, shareUidList FROM beread_keyspace.beread WHERE id = ?";

        try (Connection conn = db.getConnection();
             PreparedStatement st = conn.prepareStatement(sql)) {

            st.setLong(1, id);
            ResultSet rs = st.executeQuery();
            if (!rs.next()) return null;

            return fromResultSet(rs);
        }
    }

    @Override
    public void update(BeRead b) throws Exception {
        String sql = """
            UPDATE beread_keyspace.beread
            SET readNum = ?, readUidList = ?, commentNum = ?, commentUidList = ?, agreeNum = ?, agreeUidList = ?, shareNum = ?, shareUidList = ?
            WHERE id = ?
        """;

        try (Connection conn = db.getConnection();
             PreparedStatement st = conn.prepareStatement(sql)) {
            st.setInt(1, b.getReadNum());
            st.setString(2, gson.toJson(b.getReadUidListList()));
            st.setInt(3, b.getCommentNum());
            st.setString(4, gson.toJson(b.getCommentUidListList()));
            st.setInt(5, b.getAgreeNum());
            st.setString(6, gson.toJson(b.getAgreeUidListList()));
            st.setInt(7, b.getShareNum());
            st.setString(8, gson.toJson(b.getShareUidListList()));
            st.setLong(9, b.getId());
            st.executeUpdate();
        }
    }

    private void fillStatement(BeRead b, PreparedStatement st, int startIdx) throws SQLException {
        int i = startIdx;
        st.setString(i++, b.getAid());
        st.setString(i++, emptyToNull(b.getCategory()));
        st.setInt(i++, b.getReadNum());
        st.setString(i++, gson.toJson(b.getReadUidListList()));
        st.setInt(i++, b.getCommentNum());
        st.setString(i++, gson.toJson(b.getCommentUidListList()));
        st.setInt(i++, b.getAgreeNum());
        st.setString(i++, gson.toJson(b.getAgreeUidListList()));
        st.setInt(i++, b.getShareNum());
        st.setString(i++, gson.toJson(b.getShareUidListList()));
    }

    /** Convert empty strings to null for nullable DB columns */
    private String emptyToNull(String s) {
        return (s == null || s.isEmpty()) ? null : s;
    }

    @Override
    public boolean delete(long id) throws Exception {
        String sql = "DELETE FROM beread_keyspace.beread WHERE id = ?";

        try (Connection conn = db.getConnection();
             PreparedStatement st = conn.prepareStatement(sql)) {

            st.setLong(1, id);
            return st.executeUpdate() > 0;
        }
    }

    @Override
    public List<BeRead> list() throws Exception {
        return list(null);
    }
    
    @Override
    public List<BeRead> list(String rsqlFilter) throws Exception {
        return list(rsqlFilter, 100, 0, null, null);
    }
    
    @Override
    public List<BeRead> list(String rsqlFilter, int limit, int offset, String sortBy, String sortDir) throws Exception {
        String baseSql = "SELECT id, timestamp, aid, category, readNum, readUidList, commentNum, commentUidList, agreeNum, agreeUidList, shareNum, shareUidList FROM beread_keyspace.beread";
        
        // Convert RSQL to SQL WHERE clause
        RsqlToSql.SqlResult filterResult = rsqlConverter.convert(rsqlFilter);
        
        // Validate and build ORDER BY clause
        String orderBy = buildOrderByClause(sortBy, sortDir);
        
        // Build final query with offset-based pagination
        String sql = baseSql + " WHERE " + filterResult.whereClause + orderBy + " LIMIT ? OFFSET ?";

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
            List<BeRead> out = new ArrayList<>();

            while (rs.next()) {
                out.add(fromResultSet(rs));
            }

            return out;
        }
    }
    
    @Override
    public long count(String rsqlFilter) throws Exception {
        String baseSql = "SELECT COUNT(*) FROM beread_keyspace.beread";
        
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
    
    /**
     * Build a safe ORDER BY clause, validating the column name against allowed columns
     */
    private String buildOrderByClause(String sortBy, String sortDir) {
        // Default to sorting by id if no sort specified
        if (sortBy == null || sortBy.isEmpty()) {
            return " ORDER BY id";
        }
        
        // Validate column name against allowed columns to prevent SQL injection
        if (!rsqlConverter.getAllowedColumns().contains(sortBy)) {
            return " ORDER BY id";
        }
        
        // Validate sort direction
        String direction = "ASC";
        if (sortDir != null && sortDir.equalsIgnoreCase("desc")) {
            direction = "DESC";
        }
        
        return " ORDER BY " + sortBy + " " + direction;
    }
}
