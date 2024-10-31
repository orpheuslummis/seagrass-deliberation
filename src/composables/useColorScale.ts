import { computed } from "vue";

export function useColorScale() {
    const categoryColors = {
        "Social": "#4C51BF",
        "Management": "#38A169",
        "Environmental": "#2B6CB0",
        "Economic": "#C53030",
    };

    const getColorForCategory = (category: string): string => {
        return categoryColors[category as keyof typeof categoryColors] ||
            "#718096";
    };

    return {
        getColorForCategory,
    };
}
