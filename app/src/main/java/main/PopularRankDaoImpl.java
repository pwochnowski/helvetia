package helvetia.main;

import helvetia.PopularRank;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

public class PopularRankDaoImpl implements PopularRankDao {

    private final DB db;
    private final Gson gson = new Gson();
    
    // RSQL to SQL converter with allowed columns
    private final RsqlToSql rsqlConverter = new RsqlToSql(Set.of(
        "id", "timestamp", "temporalGranularity", "rankDate"
    ));

    public PopularRankDaoImpl(DB db) {
        this.db = db;
    }

    PopularRank fromResultSet(ResultSet rs) throws SQLException {
        String jsonArticleAidList = rs.getString("articleAidList");
        List<String> articleAidList = new ArrayList<>();
        if (jsonArticleAidList != null && !jsonArticleAidList.isEmpty()) {
            articleAidList = gson.fromJson(jsonArticleAidList, new TypeToken<List<String>>(){}.getType());
        }

        Timestamp ts = rs.getTimestamp("timestamp");
        long timestampMillis = ts != null ? ts.getTime() : 0;
        
        Date rankDate = rs.getDate("rankDate");
        String rankDateStr = rankDate != null ? rankDate.toString() : "";

        return PopularRank.newBuilder()
                .setId(rs.getLong("id"))
                .setTimestamp(timestampMillis)
                .setTemporalGranularity(nullToEmpty(rs.getString("temporalGranularity")))
                .addAllArticleAidList(articleAidList)
                .setRankDate(rankDateStr)
                .build();
    }

    /** Convert null to empty string for protobuf string fields */
    private String nullToEmpty(String s) {
        return s == null ? "" : s;
    }

    @Override
    public void create(PopularRank p) throws Exception {
        String sql = """
            INSERT INTO popularrank_keyspace.popular_rank (id, temporalGranularity, articleAidList, rankDate)
            VALUES (?, ?, ?, ?)
        """;

        try (Connection conn = db.getConnection();
            PreparedStatement st = conn.prepareStatement(sql)) {
            st.setLong(1, p.getId());
            st.setString(2, p.getTemporalGranularity());
            st.setString(3, gson.toJson(p.getArticleAidListList()));
            st.setDate(4, Date.valueOf(p.getRankDate()));
            st.executeUpdate();
        }
    }

    @Override
    public PopularRank get(long id) throws Exception {
        String sql = "SELECT id, timestamp, temporalGranularity, articleAidList, rankDate FROM popularrank_keyspace.popular_rank WHERE id = ?";

        try (Connection conn = db.getConnection();
             PreparedStatement st = conn.prepareStatement(sql)) {

            st.setLong(1, id);
            ResultSet rs = st.executeQuery();
            if (!rs.next()) return null;

            return fromResultSet(rs);
        }
    }

    @Override
    public void update(PopularRank p) throws Exception {
        // Note: temporalGranularity is part of the primary vindex (temporal_vdx) and cannot be updated
        String sql = """
            UPDATE popularrank_keyspace.popular_rank
            SET articleAidList = ?, rankDate = ?
            WHERE id = ?
        """;

        try (Connection conn = db.getConnection();
             PreparedStatement st = conn.prepareStatement(sql)) {
            st.setString(1, gson.toJson(p.getArticleAidListList()));
            st.setDate(2, Date.valueOf(p.getRankDate()));
            st.setLong(3, p.getId());
            st.executeUpdate();
        }
    }

    @Override
    public boolean delete(long id) throws Exception {
        String sql = "DELETE FROM popularrank_keyspace.popular_rank WHERE id = ?";

        try (Connection conn = db.getConnection();
             PreparedStatement st = conn.prepareStatement(sql)) {

            st.setLong(1, id);
            return st.executeUpdate() > 0;
        }
    }

    @Override
    public List<PopularRank> list() throws Exception {
        return list(null);
    }
    
    @Override
    public List<PopularRank> list(String rsqlFilter) throws Exception {
        return list(rsqlFilter, 100, 0, null, null);
    }
    
    @Override
    public List<PopularRank> list(String rsqlFilter, int limit, int offset, String sortBy, String sortDir) throws Exception {
        String baseSql = "SELECT id, timestamp, temporalGranularity, articleAidList, rankDate FROM popularrank_keyspace.popular_rank";
        
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
            List<PopularRank> out = new ArrayList<>();

            while (rs.next()) {
                out.add(fromResultSet(rs));
            }

            return out;
        }
    }
    
    @Override
    public long count(String rsqlFilter) throws Exception {
        String baseSql = "SELECT COUNT(*) FROM popularrank_keyspace.popular_rank";
        
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
