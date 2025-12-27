package helvetia.main;

import helvetia.Article;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

public class ArticleDaoImpl implements ArticleDao {

    private final DB db;
    private final Gson gson = new Gson();
    
    // WebHDFS base URL for generating download links
    // Format: http://<namenode>:<port>/webhdfs/v1
    private static final String WEBHDFS_BASE_URL = System.getenv().getOrDefault(
        "WEBHDFS_BASE_URL", 
        "http://localhost:9870/webhdfs/v1"
    );
    
    // RSQL to SQL converter with allowed columns
    private final RsqlToSql rsqlConverter = new RsqlToSql(Set.of(
        "id", "timestamp", "aid", "title", "category", "abstract", "language"
    ));

    public ArticleDaoImpl(DB db) {
        this.db = db;
    }

    Article fromResultSet(ResultSet rs) throws SQLException {
        String jsonTags = rs.getString("articleTags");
        List<String> tagList = new ArrayList<>();
        if (jsonTags != null && !jsonTags.isEmpty()) {
            tagList = gson.fromJson(jsonTags, new TypeToken<List<String>>(){}.getType());
        }
        
        String jsonAuthors = rs.getString("authors");
        List<String> authorList = new ArrayList<>();
        if (jsonAuthors != null && !jsonAuthors.isEmpty()) {
            authorList = gson.fromJson(jsonAuthors, new TypeToken<List<String>>(){}.getType());
        }

        Timestamp ts = rs.getTimestamp("timestamp");
        long timestampMillis = ts != null ? ts.getTime() : 0;

        Article.Builder builder = Article.newBuilder()
                .setId(rs.getLong("id"))
                .setTimestamp(timestampMillis)
                .setAid(nullToEmpty(rs.getString("aid")))
                .setTitle(nullToEmpty(rs.getString("title")))
                .setCategory(nullToEmpty(rs.getString("category")))
                .setAbstract(nullToEmpty(rs.getString("abstract")))
                .addAllArticleTags(tagList)
                .addAllAuthors(authorList)
                .setLanguage(nullToEmpty(rs.getString("language")));
        
        // Handle HDFS file paths and generate download URLs
        String textPath = rs.getString("textPath");
        if (textPath != null && !textPath.isEmpty()) {
            builder.setTextPath(textPath);
            builder.setTextUrl(generateHdfsDownloadUrl(textPath));
        }
        
        String imagePath = rs.getString("imagePath");
        if (imagePath != null && !imagePath.isEmpty()) {
            builder.setImagePath(imagePath);
            builder.setImageUrl(generateHdfsDownloadUrl(imagePath));
        }
        
        String videoPath = rs.getString("videoPath");
        if (videoPath != null && !videoPath.isEmpty()) {
            builder.setVideoPath(videoPath);
            builder.setVideoUrl(generateHdfsDownloadUrl(videoPath));
        }

        return builder.build();
    }
    
    /**
     * Generate a WebHDFS download URL for an HDFS path.
     * The URL uses the OPEN operation which redirects to the DataNode for streaming.
     * @param hdfsPath The HDFS path (e.g., /articles/123/image.jpg)
     * @return WebHDFS URL for downloading the file
     */
    private String generateHdfsDownloadUrl(String hdfsPath) {
        // Ensure path starts with /
        if (!hdfsPath.startsWith("/")) {
            hdfsPath = "/" + hdfsPath;
        }
        return WEBHDFS_BASE_URL + hdfsPath + "?op=OPEN";
    }

    /** Convert null to empty string for protobuf string fields */
    private String nullToEmpty(String s) {
        return s == null ? "" : s;
    }

    @Override
    public void create(Article a) throws Exception {
        String sql = """
            INSERT INTO article_keyspace.article (id, timestamp, aid, title, category, abstract, articleTags, authors, language, textPath, imagePath, videoPath)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """;

        try (Connection conn = db.getConnection();
            PreparedStatement st = conn.prepareStatement(sql)) {
            st.setLong(1, a.getId());
            fillStatement(a, st, 2);
            st.executeUpdate();
        }
    }

    @Override
    public Article get(long id) throws Exception {
        String sql = "SELECT id, timestamp, aid, title, category, abstract, articleTags, authors, language, textPath, imagePath, videoPath FROM article_keyspace.article WHERE id = ?";

        try (Connection conn = db.getConnection();
             PreparedStatement st = conn.prepareStatement(sql)) {

            st.setLong(1, id);
            ResultSet rs = st.executeQuery();
            if (!rs.next()) return null;

            return fromResultSet(rs);
        }
    }

    @Override
    public void update(Article a) throws Exception {
        // Note: id and category are part of the primary vindex (category_vdx) and cannot be updated
        String sql = """
            UPDATE article_keyspace.article
            SET title = ?, abstract = ?, articleTags = ?, authors = ?, language = ?, textPath = ?, imagePath = ?, videoPath = ?
            WHERE id = ?
        """;

        try (Connection conn = db.getConnection();
             PreparedStatement st = conn.prepareStatement(sql)) {
            st.setString(1, a.getTitle());
            st.setString(2, emptyToNull(a.getAbstract()));
            st.setString(3, gson.toJson(a.getArticleTagsList()));
            st.setString(4, gson.toJson(a.getAuthorsList()));
            st.setString(5, emptyToNull(a.getLanguage()));
            st.setString(6, emptyToNull(a.getTextPath()));
            st.setString(7, emptyToNull(a.getImagePath()));
            st.setString(8, emptyToNull(a.getVideoPath()));
            st.setLong(9, a.getId());
            st.executeUpdate();
        }
    }

    private void fillStatement(Article a, PreparedStatement st, int startIdx) throws SQLException {
        int i = startIdx;
        st.setTimestamp(i++, new Timestamp(a.getTimestamp()));
        st.setString(i++, a.getAid());
        st.setString(i++, a.getTitle());
        st.setString(i++, emptyToNull(a.getCategory()));
        st.setString(i++, emptyToNull(a.getAbstract()));
        st.setString(i++, gson.toJson(a.getArticleTagsList()));
        st.setString(i++, gson.toJson(a.getAuthorsList()));
        st.setString(i++, emptyToNull(a.getLanguage()));
        st.setString(i++, emptyToNull(a.getTextPath()));
        st.setString(i++, emptyToNull(a.getImagePath()));
        st.setString(i++, emptyToNull(a.getVideoPath()));
    }

    /** Convert empty strings to null for nullable DB columns */
    private String emptyToNull(String s) {
        return (s == null || s.isEmpty()) ? null : s;
    }

    @Override
    public boolean delete(long id) throws Exception {
        String sql = "DELETE FROM article_keyspace.article WHERE id = ?";

        try (Connection conn = db.getConnection();
             PreparedStatement st = conn.prepareStatement(sql)) {

            st.setLong(1, id);
            return st.executeUpdate() > 0;
        }
    }

    @Override
    public List<Article> list() throws Exception {
        return list(null);
    }
    
    @Override
    public List<Article> list(String rsqlFilter) throws Exception {
        return list(rsqlFilter, 10000, 0, null, null);
    }
    
    @Override
    public List<Article> list(String rsqlFilter, int limit, int offset, String sortBy, String sortDir) throws Exception {
        // Base query with HDFS path fields
        String baseSql = "SELECT id, timestamp, aid, title, category, abstract, articleTags, authors, language, textPath, imagePath, videoPath FROM article_keyspace.article";
        
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
            List<Article> out = new ArrayList<>();

            while (rs.next()) {
                out.add(fromResultSet(rs));
            }

            return out;
        }
    }
    
    @Override
    public long count(String rsqlFilter) throws Exception {
        String baseSql = "SELECT COUNT(*) FROM article_keyspace.article";
        
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
