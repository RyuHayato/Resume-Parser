from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas

c = canvas.Canvas("uploads/sample_resume.pdf", pagesize=LETTER)
width, height = LETTER
y = height - 50
lines = [
    "Jane Doe",
    "Email: jane.doe@example.com | Phone: (555) 123-4567",
    "",
    "Summary",
    "Full-stack developer with 5 years of experience.",
    "",
    "Skills",
    "Python, JavaScript, Node.js, Express, React, Docker, AWS, SQL, Git",
    "",
    "Work Experience",
    "Senior Developer, Acme Corp (2020 - Present)",
    "- Built REST APIs with Node.js and Express.",
    "- Deployed services with Docker on AWS.",
    "",
    "Junior Developer, Beta LLC (2018 - 2020)",
    "- Developed React frontends and Python scripts.",
    "",
    "Education",
    "B.Sc. Computer Science, State University (2014 - 2018)",
]
for line in lines:
    c.drawString(50, y, line)
    y -= 20
c.save()
print("created uploads/sample_resume.pdf")
