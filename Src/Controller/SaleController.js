const Course = require("../Model/CourseModel");

const getCourseDetails = async (req, res) => {
    try {
        const { courseId } = req.params; 
        const course = await Course.findById(courseId); 

        if (!course) {
            return res.status(404).json({ message: "Course not found" });
        }   
        res.status(200).json(course);
    } catch (error) {
        console.error("Error fetching course details:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

module.exports = {
    getCourseDetails
};
