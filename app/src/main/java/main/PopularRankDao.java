package helvetia.main;

import helvetia.PopularRank;
import java.util.List;

public interface PopularRankDao {
    void create(PopularRank p) throws Exception;
    PopularRank get(long id) throws Exception;
    void update(PopularRank p) throws Exception;
    boolean delete(long id) throws Exception;
    List<PopularRank> list() throws Exception;
    
    /**
     * List popular rank records with optional RSQL filter
     * @param rsqlFilter RSQL filter string, or null for no filtering
     */
    List<PopularRank> list(String rsqlFilter) throws Exception;
    
    /**
     * List popular rank records with pagination and sorting support
     * @param rsqlFilter RSQL filter string, or null for no filtering
     * @param limit Maximum number of records to return
     * @param offset Number of records to skip
     * @param sortBy Column to sort by, or null for default (id)
     * @param sortDir Sort direction: "asc" or "desc"
     */
    List<PopularRank> list(String rsqlFilter, int limit, int offset, String sortBy, String sortDir) throws Exception;
    
    /**
     * Count total popular rank records matching filter
     * @param rsqlFilter RSQL filter string, or null for no filtering
     */
    long count(String rsqlFilter) throws Exception;
}
