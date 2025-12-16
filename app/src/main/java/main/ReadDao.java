package helvetia.main;

import helvetia.Read;
import java.util.List;

public interface ReadDao {
    void create(Read r) throws Exception;
    Read get(long id) throws Exception;
    void update(Read r) throws Exception;
    boolean delete(long id) throws Exception;
    List<Read> list() throws Exception;
    
    /**
     * List reads with optional RSQL filter
     * @param rsqlFilter RSQL filter string, or null for no filtering
     */
    List<Read> list(String rsqlFilter) throws Exception;
    
    /**
     * List reads with pagination support
     * @param rsqlFilter RSQL filter string, or null for no filtering
     * @param limit Maximum number of records to return
     * @param offset Number of records to skip
     */
    List<Read> list(String rsqlFilter, int limit, int offset) throws Exception;
    
    /**
     * Count total reads matching filter
     * @param rsqlFilter RSQL filter string, or null for no filtering
     */
    long count(String rsqlFilter) throws Exception;
}
