package helvetia.main;

import helvetia.User;
import java.util.List;

public interface UserDao {
    void create(User u) throws Exception;
    User get(long id) throws Exception;
    void update(User u) throws Exception;
    boolean delete(long id) throws Exception;
    List<User> list() throws Exception;
}

