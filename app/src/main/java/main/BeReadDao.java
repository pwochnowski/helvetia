package helvetia.main;

import helvetia.BeRead;
import java.util.List;

public interface BeReadDao {
    void create(BeRead b) throws Exception;
    BeRead get(long id) throws Exception;
    void update(BeRead b) throws Exception;
    boolean delete(long id) throws Exception;
    List<BeRead> list() throws Exception;
    
    /**
     * List beread records with optional RSQL filter
     * @param rsqlFilter RSQL filter string, or null for no filtering
     */
    List<BeRead> list(String rsqlFilter) throws Exception;
    
    /**
     * List beread records with pagination and sorting support
     * @param rsqlFilter RSQL filter string, or null for no filtering
     * @param limit Maximum number of records to return
     * @param offset Number of records to skip
     * @param sortBy Column to sort by, or null for default (id)
     * @param sortDir Sort direction: "asc" or "desc"
     */
    List<BeRead> list(String rsqlFilter, int limit, int offset, String sortBy, String sortDir) throws Exception;
    
    /**
     * Count total beread records matching filter
     * @param rsqlFilter RSQL filter string, or null for no filtering
     */
    long count(String rsqlFilter) throws Exception;
}
