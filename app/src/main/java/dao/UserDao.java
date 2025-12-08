package helvetia.dao;

import helvetia.User;
import java.util.List;

public interface UserDao {
    User create(User u) throws Exception;
    User get(long id) throws Exception;
    User update(User u) throws Exception;
    boolean delete(long id) throws Exception;
    List<User> list() throws Exception;
}

