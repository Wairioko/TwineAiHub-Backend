import { UserModel } from "../schema/Users.mjs";

// Get user profile by id
export const GetUserProfile = async (req, res) => {
    const userid = req.user._id;
    

    if (!userid) {
        return res.status(404).send({ message: "User Id not found" });
    }

    try {
        // Assuming the 'userid' field is the unique identifier in your database, adjust as needed
        const findUser = await UserModel.findOne({_id:userid}); 
        console.log("the userid profile", findUser)
        if (!findUser) {
            return res.status(404).send({ message: "User not found" });
        }

        console.log("the user", findUser);
        return res.status(200).send(findUser); // 200 status for successful retrieval

    } catch (error) {
        console.error("Error fetching user", error);
        return res.status(500).send({ message: "Error fetching user profile" });
    }
};
