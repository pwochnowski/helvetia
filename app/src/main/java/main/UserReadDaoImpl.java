package helvetia.main;

import helvetia.UserRead;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Implementation of UserReadDao that performs a JOIN between user and read tables.
 * 
 * The join is done on uid and region, which allows Vitess to optimize queries:
 * - Both tables are sharded by region using the same vindex
 * - Queries with region filter are pushed to specific shards
 * - Queries with uid filter use the lookup vindex for efficient routing
 * 
 * Column naming convention:
 * - Read table columns: keep original names (id -> read_id in proto, but just 'id' in SQL alias)
 * - User table columns: prefixed with 'user_' to avoid conflicts
 */
public class UserReadDaoImpl implements UserReadDao {

    private final DB db;
    private final Gson gson = new Gson();
    
    // Map of allowed filter columns to their fully qualified SQL column names
    // This allows filtering on fields from both tables
    private static final Map<String, String> COLUMN_MAPPING = Map.ofEntries(
        // Read table fields
        Map.entry("read_id", "r.id"),
        Map.entry("read_timestamp", "r.timestamp"),
        Map.entry("uid", "r.uid"),
        Map.entry("aid", "r.aid"),
        Map.entry("region", "r.region"),
        Map.entry("readTimeLength", "r.readTimeLength"),
        Map.entry("agreeOrNot", "r.agreeOrNot"),
        Map.entry("commentOrNot", "r.commentOrNot"),
        Map.entry("commentDetail", "r.commentDetail"),
        Map.entry("shareOrNot", "r.shareOrNot"),
        // User table fields
        Map.entry("user_id", "u.id"),
        Map.entry("user_timestamp", "u.timestamp"),
        Map.entry("user_name", "u.name"),
        Map.entry("user_gender", "u.gender"),
        Map.entry("user_email", "u.email"),
        Map.entry("user_phone", "u.phone"),
        Map.entry("user_dept", "u.dept"),
        Map.entry("user_grade", "u.grade"),
        Map.entry("user_language", "u.language"),
        Map.entry("user_role", "u.role"),
        Map.entry("user_obtainedCredits", "u.obtainedCredits")
    );
    
    // RSQL converter with column mapping for joined query
    private final RsqlToSqlWithMapping rsqlConverter;

    public UserReadDaoImpl(DB db) {
        this.db = db;
        this.rsqlConverter = new RsqlToSqlWithMapping(COLUMN_MAPPING);
    }

    /**
     * Build the SELECT clause for the joined query
     */
    private String getSelectClause() {
        return """
            SELECT
                r.id as read_id,
                r.timestamp as read_timestamp,
                r.uid,
                r.aid,
                r.region,
                r.readTimeLength,
                r.agreeOrNot,
                r.commentOrNot,
                r.commentDetail,
                r.shareOrNot,
                u.id as user_id,
                u.timestamp as user_timestamp,
                u.name as user_name,
                u.gender as user_gender,
                u.email as user_email,
                u.phone as user_phone,
                u.dept as user_dept,
                u.grade as user_grade,
                u.language as user_language,
                u.role as user_role,
                u.preferTags as user_preferTags,
                u.obtainedCredits as user_obtainedCredits
            """;
    }
    
    /**
     * Build the FROM/JOIN clause.
     * The join on uid AND region ensures Vitess can route to the correct shard
     * when filtering on these columns.
     */
    private String getFromClause() {
        return """
            FROM read_keyspace.read r
            INNER JOIN user_keyspace.user u ON r.uid = u.uid AND r.region = u.region
            """;
    }

    UserRead fromResultSet(ResultSet rs) throws SQLException {
        // Parse user preferTags from JSON
        String jsonTags = rs.getString("user_preferTags");
        List<String> tagList = new ArrayList<>();
        if (jsonTags != null && !jsonTags.isEmpty()) {
            tagList = gson.fromJson(jsonTags, new TypeToken<List<String>>(){}.getType());
        }

        Timestamp readTs = rs.getTimestamp("read_timestamp");
        long readTimestampMillis = readTs != null ? readTs.getTime() : 0;
        
        Timestamp userTs = rs.getTimestamp("user_timestamp");
        long userTimestampMillis = userTs != null ? userTs.getTime() : 0;

        UserRead.Builder builder = UserRead.newBuilder()
                // Read fields
                .setReadId(rs.getLong("read_id"))
                .setReadTimestamp(readTimestampMillis)
                .setUid(nullToEmpty(rs.getString("uid")))
                .setAid(nullToEmpty(rs.getString("aid")))
                .setRegion(nullToEmpty(rs.getString("region")))
                .setReadTimeLength(rs.getInt("readTimeLength"))
                .setAgreeOrNot(rs.getBoolean("agreeOrNot"))
                .setCommentOrNot(rs.getBoolean("commentOrNot"))
                .setCommentDetail(nullToEmpty(rs.getString("commentDetail")))
                .setShareOrNot(rs.getBoolean("shareOrNot"))
                // User fields
                .setUserId(rs.getLong("user_id"))
                .setUserTimestamp(userTimestampMillis)
                .setUserName(nullToEmpty(rs.getString("user_name")))
                .setUserGender(nullToEmpty(rs.getString("user_gender")))
                .setUserEmail(nullToEmpty(rs.getString("user_email")))
                .setUserPhone(nullToEmpty(rs.getString("user_phone")))
                .setUserDept(nullToEmpty(rs.getString("user_dept")))
                .setUserGrade(nullToEmpty(rs.getString("user_grade")))
                .setUserLanguage(nullToEmpty(rs.getString("user_language")))
                .setUserRole(nullToEmpty(rs.getString("user_role")))
                .addAllUserPreferTags(tagList)
                .setUserObtainedCredits(rs.getInt("user_obtainedCredits"));

        return builder.build();
    }

    private String nullToEmpty(String s) {
        return s == null ? "" : s;
    }

    @Override
    public List<UserRead> list(String rsqlFilter, int limit, int offset, String sortBy, String sortDir) throws Exception {
        StringBuilder sql = new StringBuilder();
        sql.append(getSelectClause());
        sql.append(getFromClause());
        
        List<Object> params = new ArrayList<>();
        
        // Convert RSQL filter to SQL WHERE clause
        if (rsqlFilter != null && !rsqlFilter.isBlank()) {
            RsqlToSqlWithMapping.SqlResult result = rsqlConverter.convert(rsqlFilter);
            String whereClause = result.whereClause;
            List<Object> whereParams = new ArrayList<>(result.parameters);
            
            // Optimization for Vitess: when filtering by region on read table (r.region),
            // also add the same filter on user table (u.region) to enable single-shard routing.
            // This allows Vitess to use the region_lookup vindex on both tables.
            RegionFilterResult regionResult = addUserRegionFilter(whereClause, whereParams);
            
            sql.append(" WHERE ").append(regionResult.whereClause);
            params.addAll(regionResult.parameters);
        }
        
        // Add ORDER BY clause
        if (sortBy != null && !sortBy.isBlank()) {
            String mappedColumn = COLUMN_MAPPING.get(sortBy);
            if (mappedColumn != null) {
                sql.append(" ORDER BY ").append(mappedColumn);
                if ("desc".equalsIgnoreCase(sortDir)) {
                    sql.append(" DESC");
                } else {
                    sql.append(" ASC");
                }
            }
        } else {
            // Default sort by read timestamp descending
            sql.append(" ORDER BY r.timestamp DESC");
        }
        
        // Add LIMIT and OFFSET
        sql.append(" LIMIT ? OFFSET ?");
        params.add(limit);
        params.add(offset);

        try (Connection conn = db.getConnection();
             PreparedStatement st = conn.prepareStatement(sql.toString())) {
            
            // Set parameters
            for (int i = 0; i < params.size(); i++) {
                st.setObject(i + 1, params.get(i));
            }
            
            ResultSet rs = st.executeQuery();
            List<UserRead> results = new ArrayList<>();
            while (rs.next()) {
                results.add(fromResultSet(rs));
            }
            return results;
        }
    }

    @Override
    public long count(String rsqlFilter) throws Exception {
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT COUNT(*) ");
        sql.append(getFromClause());
        
        List<Object> params = new ArrayList<>();
        
        // Convert RSQL filter to SQL WHERE clause
        if (rsqlFilter != null && !rsqlFilter.isBlank()) {
            RsqlToSqlWithMapping.SqlResult result = rsqlConverter.convert(rsqlFilter);
            String whereClause = result.whereClause;
            List<Object> whereParams = new ArrayList<>(result.parameters);
            
            // Optimization for Vitess: when filtering by region on read table (r.region),
            // also add the same filter on user table (u.region) to enable single-shard routing.
            RegionFilterResult regionResult = addUserRegionFilter(whereClause, whereParams);
            
            sql.append(" WHERE ").append(regionResult.whereClause);
            params.addAll(regionResult.parameters);
        }

        try (Connection conn = db.getConnection();
             PreparedStatement st = conn.prepareStatement(sql.toString())) {
            
            // Set parameters
            for (int i = 0; i < params.size(); i++) {
                st.setObject(i + 1, params.get(i));
            }
            
            ResultSet rs = st.executeQuery();
            if (rs.next()) {
                return rs.getLong(1);
            }
            return 0;
        }
    }
    
    /**
     * Result of region filter optimization
     */
    private static class RegionFilterResult {
        final String whereClause;
        final List<Object> parameters;
        
        RegionFilterResult(String whereClause, List<Object> parameters) {
            this.whereClause = whereClause;
            this.parameters = parameters;
        }
    }
    
    /**
     * Optimize region filter for Vitess routing.
     * When the WHERE clause contains r.region = ?, add u.region = ? as well.
     * This allows Vitess to use the region_lookup vindex on both tables
     * and route to a single shard instead of scattering.
     * 
     * Example:
     *   Input:  "r.region = ?" with params ["Beijing"]
     *   Output: "(r.region = ? AND u.region = ?)" with params ["Beijing", "Beijing"]
     */
    private RegionFilterResult addUserRegionFilter(String whereClause, List<Object> params) {
        // Find region parameter index - r.region is mapped to position in params
        // We need to find where "r.region = ?" appears and duplicate that parameter
        
        int regionParamIndex = findRegionParamIndex(whereClause);
        
        if (regionParamIndex >= 0 && regionParamIndex < params.size()) {
            // Get the region value
            Object regionValue = params.get(regionParamIndex);
            
            // Replace r.region = ? with (r.region = ? AND u.region = ?)
            whereClause = whereClause.replace("r.region = ?", "(r.region = ? AND u.region = ?)");
            
            // Insert duplicate parameter right after the original
            List<Object> newParams = new ArrayList<>();
            for (int i = 0; i < params.size(); i++) {
                newParams.add(params.get(i));
                if (i == regionParamIndex) {
                    newParams.add(regionValue); // Duplicate the region param
                }
            }
            return new RegionFilterResult(whereClause, newParams);
        }
        
        // No parameterized region filter found, return unchanged
        return new RegionFilterResult(whereClause, params);
    }
    
    /**
     * Find the parameter index for r.region in the WHERE clause.
     * Counts the number of ? placeholders before r.region = ?
     */
    private int findRegionParamIndex(String whereClause) {
        int regionPos = whereClause.indexOf("r.region = ?");
        if (regionPos < 0) {
            return -1;
        }
        
        // Count ? before regionPos
        int count = 0;
        for (int i = 0; i < regionPos; i++) {
            if (whereClause.charAt(i) == '?') {
                count++;
            }
        }
        return count;
    }
}
