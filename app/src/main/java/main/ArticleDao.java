package helvetia.main;

import helvetia.Article;
import java.util.List;

public interface ArticleDao {
    void create(Article a) throws Exception;
    Article get(long id) throws Exception;
    void update(Article a) throws Exception;
    boolean delete(long id) throws Exception;
    List<Article> list() throws Exception;
    
    /**
     * List articles with optional RSQL filter
     * @param rsqlFilter RSQL filter string, or null for no filtering
     */
    List<Article> list(String rsqlFilter) throws Exception;
    
    /**
     * List articles with pagination and sorting support
     * @param rsqlFilter RSQL filter string, or null for no filtering
     * @param limit Maximum number of records to return
     * @param offset Number of records to skip
     * @param sortBy Column to sort by, or null for default (id)
     * @param sortDir Sort direction: "asc" or "desc"
     */
    List<Article> list(String rsqlFilter, int limit, int offset, String sortBy, String sortDir) throws Exception;
    
    /**
     * Count total articles matching filter
     * @param rsqlFilter RSQL filter string, or null for no filtering
     */
    long count(String rsqlFilter) throws Exception;
}
