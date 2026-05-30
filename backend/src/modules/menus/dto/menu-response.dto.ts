export interface MenuItemResponse {
  id: string;
  recipeId: string;
  recipeName: string;
  price: number;
  cost: number;
  margin: number;
  isAvailable: boolean;
  allergens?: number[];
}

export interface MenuSectionResponse {
  id: string;
  name: string;
  order: number;
  items: MenuItemResponse[];
}

export interface MenuTranslationResponse {
  id: string;
  language: string;
  name: string;
  description?: string;
  sectionsTranslations?: Record<string, string>;
}

export interface MenuCostBreakdown {
  totalCost: number;
  totalPrice: number;
  totalMargin: number;
  averageMarginPercentage: number;
  costPerPortion: number;
  pricePerPortion: number;
}

export interface MenuResponse {
  id: string;
  name: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  portions: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  sections: MenuSectionResponse[];
  translations?: MenuTranslationResponse[];
  costBreakdown?: MenuCostBreakdown;
}