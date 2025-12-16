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
}
