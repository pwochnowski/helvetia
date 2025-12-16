package helvetia.main;

import helvetia.Read;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

public class ReadDaoImpl implements ReadDao {

    private final DB db;
    
    // RSQL to SQL converter with allowed columns
    private final RsqlToSql rsqlConverter = new RsqlToSql(Set.of(
        "id", "timestamp", "uid", "aid", "region", "readTimeLength",
        "agreeOrNot", "commentOrNot", "shareOrNot"
    ));

    public ReadDaoImpl(DB db) {
        this.db = db;
    }

    Read fromResultSet(ResultSet rs) throws SQLException {
        Timestamp ts = rs.getTimestamp("timestamp");
        long timestampMillis = ts != null ? ts.getTime() : 0;

        Read.Builder builder = Read.newBuilder()
                .setId(rs.getLong("id"))
                .setTimestamp(timestampMillis)
                .setUid(nullToEmpty(rs.getString("uid")))
                .setAid(nullToEmpty(rs.getString("aid")))
                .setRegion(nullToEmpty(rs.getString("region")))
                .setReadTimeLength(rs.getInt("readTimeLength"))
                .setAgreeOrNot(rs.getBoolean("agreeOrNot"))
                .setCommentOrNot(rs.getBoolean("commentOrNot"))
                .setCommentDetail(nullToEmpty(rs.getString("commentDetail")))
                .setShareOrNot(rs.getBoolean("shareOrNot"));

        return builder.build();
    }

    /** Convert null to empty string for protobuf string fields */
    private String nullToEmpty(String s) {
        return s == null ? "" : s;
    }

    @Override
    public void create(Read r) throws Exception {
        String sql = """
            INSERT INTO read_keyspace.read (id, timestamp, uid, aid, region, readTimeLength, agreeOrNot, commentOrNot, commentDetail, shareOrNot)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """;

        try (Connection conn = db.getConnection();
            PreparedStatement st = conn.prepareStatement(sql)) {
            st.setLong(1, r.getId());
            fillStatement(r, st, 2);
            st.executeUpdate();
        }
    }

    @Override
    public Read get(long id) throws Exception {
        String sql = "SELECT id, timestamp, uid, aid, region, readTimeLength, agreeOrNot, commentOrNot, commentDetail, shareOrNot FROM read_keyspace.read WHERE id = ?";

        try (Connection conn = db.getConnection();
             PreparedStatement st = conn.prepareStatement(sql)) {

            st.setLong(1, id);
            ResultSet rs = st.executeQuery();
            if (!rs.next()) return null;

            return fromResultSet(rs);
        }
    }

    @Override
    public void update(Read r) throws Exception {
        String sql = """
            UPDATE read_keyspace.read
            SET readTimeLength = ?, agreeOrNot = ?, commentOrNot = ?, commentDetail = ?, shareOrNot = ?
            WHERE id = ?
        """;

        try (Connection conn = db.getConnection();
             PreparedStatement st = conn.prepareStatement(sql)) {
            st.setInt(1, r.getReadTimeLength());
            st.setBoolean(2, r.getAgreeOrNot());
            st.setBoolean(3, r.getCommentOrNot());
            st.setString(4, emptyToNull(r.getCommentDetail()));
            st.setBoolean(5, r.getShareOrNot());
            st.setLong(6, r.getId());
            st.executeUpdate();
        }
    }

    private void fillStatement(Read r, PreparedStatement st, int startIdx) throws SQLException {
        int i = startIdx;
        st.setTimestamp(i++, new Timestamp(r.getTimestamp()));
        st.setString(i++, r.getUid());
        st.setString(i++, r.getAid());
        st.setString(i++, r.getRegion());
        st.setInt(i++, r.getReadTimeLength());
        st.setBoolean(i++, r.getAgreeOrNot());
        st.setBoolean(i++, r.getCommentOrNot());
        st.setString(i++, emptyToNull(r.getCommentDetail()));
        st.setBoolean(i++, r.getShareOrNot());
    }

    /** Convert empty strings to null for nullable DB columns */
    private String emptyToNull(String s) {
        return (s == null || s.isEmpty()) ? null : s;
    }

    @Override
    public boolean delete(long id) throws Exception {
        String sql = "DELETE FROM read_keyspace.read WHERE id = ?";

        try (Connection conn = db.getConnection();
             PreparedStatement st = conn.prepareStatement(sql)) {

            st.setLong(1, id);
            return st.executeUpdate() > 0;
        }
    }

    @Override
    public List<Read> list() throws Exception {
        return list(null);
    }
    
    @Override
    public List<Read> list(String rsqlFilter) throws Exception {
        String baseSql = "SELECT id, timestamp, uid, aid, region, readTimeLength, agreeOrNot, commentOrNot, commentDetail, shareOrNot FROM read_keyspace.read";
        
        // Convert RSQL to SQL WHERE clause
        RsqlToSql.SqlResult filterResult = rsqlConverter.convert(rsqlFilter);
        
        // Build final query
        String sql = baseSql + " WHERE " + filterResult.whereClause + " ORDER BY id LIMIT 10000";

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
            List<Read> out = new ArrayList<>();

            while (rs.next()) {
                out.add(fromResultSet(rs));
            }

            return out;
        }
    }
}
