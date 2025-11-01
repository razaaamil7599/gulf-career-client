import API_BASE_URL from "../api/config";

async function fetchVacancies() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/vacancies`);
        if (!response.ok) {
            throw new Error("Network response was not ok");
        }
        const data = await response.json();
        console.log("Fetched vacancies:", data);
    } catch (error) {
        console.error("Error fetching vacancies:", error);
    }
}

fetchVacancies();
