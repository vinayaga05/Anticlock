import React, { useEffect, useRef, useState } from 'react';
import { launchImageLibrary } from 'react-native-image-picker';
import { useRoute } from '@react-navigation/native';
import type {
  FitnessFood,
  FitnessLog,
  FitnessNutrients,
  FitnessRecipe,
} from '@anticlock/contracts';
import {
  newFitnessRequestId,
  useFitnessMutation,
  useFitnessQuery,
} from '../api/fitnessApi';
import {
  emptyNutrients,
  fitnessDateValid,
  localFitnessDate,
  nutrientKeys,
  numberLabel,
} from '../fitnessModel';
import { uploadFitnessMedia } from '../fitnessMedia';
import { FitnessPrivateMedia } from '../components/FitnessPrivateMedia';
import {
  FitnessAction,
  FitnessCard,
  FitnessChoices,
  FitnessEmpty,
  FitnessField,
  FitnessLoading,
  FitnessNotice,
  FitnessScreen,
  FitnessSection,
  FitnessText,
} from '../components/FitnessUI';

type FoodEntry = {
  foodId?: string;
  name: string;
  servings: number;
  nutrients: FitnessNutrients;
};
const nutrientLabel = {
  calories: 'Calories (kcal)',
  proteinG: 'Protein (g)',
  carbsG: 'Carbs (g)',
  fatG: 'Fat (g)',
  fibreG: 'Fibre (g)',
};
export function FitnessMealsScreen() {
  const route = useRoute<any>();
  const [date, setDate] = useState(route.params?.date ?? localFitnessDate());
  const [mealType, setMealType] = useState('breakfast');
  const [search, setSearch] = useState('');
  const [queryText, setQueryText] = useState('');
  const foodsQuery = useFitnessQuery<{ foods: FitnessFood[] }>(
    `/foods?q=${encodeURIComponent(queryText)}`,
  );
  const recipes = useFitnessQuery<{ recipes: FitnessRecipe[] }>('/recipes');
  const catalogue = useFitnessQuery<{
    foods: Array<Omit<FitnessFood, 'id'> & { barcode: string }>;
    notice?: string;
  }>(
    `/foods/search?q=${encodeURIComponent(queryText)}`,
    queryText.trim().length >= 2,
  );
  const logs = useFitnessQuery<{ logs: FitnessLog[] }>(
    `/logs/meal?from=${date}&to=${date}`,
    fitnessDateValid(date),
  );
  const mutation = useFitnessMutation<any>();
  const [mode, setMode] = useState('Journal');
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [notes, setNotes] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const requestId = useRef(newFitnessRequestId());
  const [entryText, setEntryText] = useState<Record<string, string>>({});
  const [manualName, setManualName] = useState('');
  const [servingName, setServingName] = useState('serving');
  const [servingGrams, setServingGrams] = useState('');
  const [servings, setServings] = useState('1');
  const [nutrients, setNutrients] = useState<
    Record<keyof FitnessNutrients, string>
  >({ calories: '', proteinG: '', carbsG: '', fatG: '', fibreG: '' });
  const [manualFoodId, setManualFoodId] = useState<string>();
  const [manualTarget, setManualTarget] = useState<'meal' | 'recipe'>('meal');
  const [recipeName, setRecipeName] = useState('');
  const [recipeServings, setRecipeServings] = useState('1');
  const [recipeIngredients, setRecipeIngredients] = useState<
    Array<{ foodId: string; servings: number; name: string }>
  >([]);
  const foodRequest = useRef({ id: newFitnessRequestId(), signature: '' });
  const recipeRequest = useRef({ id: newFitnessRequestId(), signature: '' });
  const mealSignature = useRef('');
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [estimate, setEstimate] = useState(false);
  const [photo, setPhoto] = useState<{
    uri: string;
    name: string;
    type: string;
    clientRequestId: string;
    purpose: 'meal';
    id?: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const existing = useFitnessQuery<{ log: FitnessLog }>(
    `/logs/meal/${route.params?.logId ?? ''}`,
    Boolean(route.params?.logId),
  );
  const hydrated = useRef(false);
  useEffect(() => {
    if (existing.data?.log && !hydrated.current) {
      const log = existing.data.log;
      const data = log.data as any;
      setEditing(log.id);
      setDate(log.date);
      setMealType(data.mealType);
      setEntries(data.foods);
      setNotes(data.notes ?? '');
      setMediaIds(data.mediaIds ?? []);
      setEstimate(Boolean(data.estimate));
      hydrated.current = true;
    }
  }, [existing.data]);
  const totals = entries.reduce(
    (sum, entry) =>
      Object.fromEntries(
        nutrientKeys.map(key => [
          key,
          sum[key] + entry.nutrients[key] * entry.servings,
        ]),
      ) as FitnessNutrients,
    { ...emptyNutrients },
  );
  function positiveServings() {
    const n = Number(servings);
    if (!Number.isFinite(n) || n <= 0 || n > 100)
      throw new Error('Enter servings between 0 and 100.');
    return n;
  }
  function parsedNutrients(): FitnessNutrients {
    const result = Object.fromEntries(
      nutrientKeys.map(key => [key, Number(nutrients[key])]),
    ) as FitnessNutrients;
    if (
      nutrientKeys.some(
        key =>
          nutrients[key].trim() === '' ||
          !Number.isFinite(result[key]) ||
          result[key] < 0,
      )
    )
      throw new Error(
        'Enter a valid amount for all five nutrient fields, including zero.',
      );
    return result;
  }
  function addFood(food: FitnessFood) {
    setError('');
    try {
      const count = positiveServings();
      if (food.isEstimate || food.source === 'open_food_facts') {
        setManualTarget(mode === 'Recipes' ? 'recipe' : 'meal');
        setManualFoodId(food.id);
        setManualName(food.name);
        setServingName(food.servingName);
        setServingGrams(String(food.servingGrams));
        setNutrients(
          Object.fromEntries(
            nutrientKeys.map(key => [
              key,
              food.missingNutrients?.includes(key)
                ? ''
                : String(food.nutrients[key]),
            ]),
          ) as typeof nutrients,
        );
        setEstimate(true);
        setMode('Manual food');
        setNotice(
          'Review the catalogue values against the package label. Missing nutrients are left blank and must be supplied before logging. Recipe ingredients must be saved as a private custom food after review.',
        );
        return;
      }
      if (mode === 'Recipes')
        setRecipeIngredients(items => [
          ...items,
          { foodId: food.id, servings: count, name: food.name },
        ]);
      else
        setEntries(items => [
          ...items,
          {
            foodId: food.id,
            name: food.name,
            servings: count,
            nutrients: food.nutrients,
          },
        ]);
      setNotice(`${food.name} added to your draft.`);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function importFood(barcode: string) {
    setError('');
    try {
      positiveServings();
      const response = await mutation.mutateAsync({
        path: '/foods/import',
        body: { barcode },
      });
      addFood(response.food);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function addManual() {
    setError('');
    try {
      if (manualTarget === 'recipe')
        throw new Error(
          'Save this reviewed ingredient as a private custom food to use it in your recipe.',
        );
      if (!manualName.trim()) throw new Error('Name your food or estimate.');
      setEntries(items => [
        ...items,
        {
          ...(manualFoodId ? { foodId: manualFoodId } : {}),
          name: manualName.trim(),
          servings: positiveServings(),
          nutrients: parsedNutrients(),
        },
      ]);
      setNotice('Food added to your meal draft.');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function saveCustomFood() {
    setError('');
    try {
      positiveServings();
      const input = {
        name: manualName,
        servingName,
        servingGrams: Number(servingGrams),
        nutrients: parsedNutrients(),
      };
      const signature = JSON.stringify(input);
      if (
        foodRequest.current.signature &&
        foodRequest.current.signature !== signature
      )
        foodRequest.current.id = newFitnessRequestId();
      foodRequest.current.signature = signature;
      const response = await mutation.mutateAsync({
        path: '/foods',
        body: { ...input, clientRequestId: foodRequest.current.id },
      });
      if (manualTarget === 'recipe') {
        setRecipeIngredients(items => [
          ...items,
          {
            foodId: response.food.id,
            name: response.food.name,
            servings: positiveServings(),
          },
        ]);
        setMode('Recipes');
        setManualTarget('meal');
      } else addFood(response.food);
      setNotice('Private custom food saved and added to your draft.');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function saveRecipe() {
    setError('');
    try {
      const input = {
        name: recipeName,
        servings: Number(recipeServings),
        ingredients: recipeIngredients.map(({ foodId, servings: count }) => ({
          foodId,
          servings: count,
        })),
        notes,
      };
      const signature = JSON.stringify(input);
      if (
        recipeRequest.current.signature &&
        recipeRequest.current.signature !== signature
      )
        recipeRequest.current.id = newFitnessRequestId();
      recipeRequest.current.signature = signature;
      await mutation.mutateAsync({
        path: '/recipes',
        body: { ...input, clientRequestId: recipeRequest.current.id },
      });
      setNotice('Private recipe saved.');
      setRecipeName('');
      setRecipeIngredients([]);
      recipeRequest.current = { id: newFitnessRequestId(), signature: '' };
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function saveMeal() {
    setError('');
    setNotice('');
    try {
      if (!fitnessDateValid(date))
        throw new Error('Enter a valid date in YYYY-MM-DD format.');
      if (!entries.length)
        throw new Error('Add at least one food before saving.');
      if (
        entries.some(
          (entry, index) =>
            !Number.isFinite(entry.servings) ||
            entry.servings <= 0 ||
            nutrientKeys.some(
              key =>
                !Number.isFinite(entry.nutrients[key]) ||
                entry.nutrients[key] < 0 ||
                entryText[`${index}:${key}`] === '',
            ) ||
            entryText[`${index}:servings`] === '',
        )
      )
        throw new Error(
          'Check every serving and nutrient amount. Enter zero explicitly when a nutrient is absent.',
        );
      const data = {
        mealType,
        foods: entries,
        notes,
        ...(mediaIds.length ? { mediaIds } : {}),
        ...(estimate ? { estimate: true } : {}),
      };
      const signature = JSON.stringify({ date, data });
      if (mealSignature.current && mealSignature.current !== signature)
        requestId.current = newFitnessRequestId();
      mealSignature.current = signature;
      await mutation.mutateAsync({
        path: editing ? `/logs/meal/${editing}` : '/logs/meal',
        method: editing ? 'PATCH' : 'POST',
        body: editing
          ? { data }
          : { date, clientRequestId: requestId.current, data },
      });
      setEntries([]);
      setEntryText({});
      setNotes('');
      setEditing(null);
      setMediaIds([]);
      setEstimate(false);
      setPhoto(null);
      requestId.current = newFitnessRequestId();
      mealSignature.current = '';
      setNotice('Meal saved to your private journal.');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function choosePhoto() {
    setError('');
    const selected = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
    });
    if (selected.didCancel) return;
    const asset = selected.assets?.[0];
    if (selected.errorCode || !asset?.uri || !asset.type) {
      setError(selected.errorMessage || 'Choose a readable photo.');
      return;
    }
    setPhoto({
      uri: asset.uri,
      name: asset.fileName ?? 'meal.jpg',
      type: asset.type,
      purpose: 'meal',
      clientRequestId: newFitnessRequestId(),
    });
    setNotice(
      'Photo selected on your device. Choose whether to upload privately or request an AI estimate.',
    );
  }
  async function processPhoto(ai: boolean) {
    if (!photo) return;
    setError('');
    setUploading(true);
    try {
      const media = photo.id
        ? { id: photo.id }
        : await uploadFitnessMedia(photo);
      setPhoto(p => (p ? { ...p, id: media.id } : p));
      setMediaIds(ids => [...new Set([...ids, media.id])]);
      if (ai) {
        const response = await mutation.mutateAsync({
          path: '/meals/estimate',
          body: { mediaId: media.id, consentToAI: true },
        });
        const value = response.estimate;
        setManualTarget('meal');
        setManualFoodId(undefined);
        setManualName(value.label);
        setNutrients(
          Object.fromEntries(
            nutrientKeys.map(key => [key, String(value[key] ?? 0)]),
          ) as typeof nutrients,
        );
        setEstimate(true);
        setMode('Manual food');
        setNotice(
          `Estimate ready for your review. Edit every field before adding it to your meal. ${
            value.notes ?? ''
          }`,
        );
      } else
        setNotice(
          'Private photo attached to your draft. Save your meal to link it.',
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <FitnessScreen
      busy={mutation.isPending || uploading}
      title="Nourish, without judgement"
      subtitle="A private record of meals, portions and how your day feels."
    >
      {route.params?.logId && existing.isPending && <FitnessLoading />}
      {existing.isError && (
        <>
          <FitnessNotice error message={existing.error.message} />
          <FitnessAction
            label="Retry saved meal"
            secondary
            onPress={() => {
              void existing.refetch();
            }}
          />
        </>
      )}
      <FitnessField
        label="Journal date"
        value={date}
        onChangeText={setDate}
        editable={!editing}
        placeholder="YYYY-MM-DD"
      />
      <FitnessChoices
        label="Meal"
        options={['breakfast', 'lunch', 'dinner', 'snack']}
        selected={mealType}
        onChange={setMealType}
      />
      <FitnessChoices
        label="Add to your journal"
        options={['Journal', 'Manual food', 'Recipes', 'Photo']}
        selected={mode}
        onChange={setMode}
      />
      {(mode === 'Journal' || mode === 'Recipes') && (
        <FitnessCard>
          <FitnessSection
            title={
              mode === 'Recipes' ? 'Build a private recipe' : 'Find a food'
            }
          />
          <FitnessField
            label="Food search"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => setQueryText(search)}
            returnKeyType="search"
          />
          <FitnessAction
            label="Search foods"
            secondary
            onPress={() => setQueryText(search)}
          />
          <FitnessField
            label="Number of servings"
            value={servings}
            onChangeText={setServings}
            keyboardType="decimal-pad"
          />
          {foodsQuery.isPending ? (
            <FitnessLoading />
          ) : foodsQuery.isError ? (
            <>
              <FitnessNotice error message={foodsQuery.error.message} />
              <FitnessAction
                label="Retry food search"
                secondary
                onPress={() => {
                  void foodsQuery.refetch();
                }}
              />
            </>
          ) : foodsQuery.data?.foods.length ? (
            foodsQuery.data.foods.map(food => (
              <FitnessCard key={food.id}>
                <FitnessText>
                  {food.name} · {food.servingName} ({food.servingGrams} g)
                </FitnessText>
                <FitnessText muted>
                  {food.nutrients.calories} kcal · P {food.nutrients.proteinG} g
                  · C {food.nutrients.carbsG} g · F {food.nutrients.fatG} g ·
                  Fibre{' '}
                  {food.missingNutrients?.includes('fibreG')
                    ? 'not supplied'
                    : `${food.nutrients.fibreG} g`}{' '}
                  per serving
                </FitnessText>
                <FitnessAction
                  label={`Add ${food.name}`}
                  secondary
                  onPress={() => addFood(food)}
                />
              </FitnessCard>
            ))
          ) : (
            <FitnessText muted>
              No matching foods yet. Add a private custom food using its label.
            </FitnessText>
          )}
        </FitnessCard>
      )}
      {(mode === 'Journal' || mode === 'Recipes') &&
        queryText.trim().length >= 2 && (
          <FitnessCard>
            <FitnessSection
              title="Food catalogue"
              caption="Open Food Facts · Check the package label and portion size. Catalogue data cannot establish allergen safety."
            />
            {catalogue.isPending ? (
              <FitnessLoading />
            ) : catalogue.isError ? (
              <>
                <FitnessNotice error message={catalogue.error.message} />
                <FitnessAction
                  label="Retry catalogue search"
                  secondary
                  onPress={() => {
                    void catalogue.refetch();
                  }}
                />
                <FitnessAction
                  label="Enter food manually"
                  secondary
                  onPress={() => setMode('Manual food')}
                />
              </>
            ) : (
              <>
                <FitnessNotice message={catalogue.data?.notice} />
                {catalogue.data?.foods.length ? (
                  catalogue.data.foods.map(food => (
                    <FitnessCard key={food.barcode}>
                      <FitnessSection
                        title={food.name}
                        caption={`${food.servingName} · ${food.servingGrams} g`}
                      />
                      <FitnessText muted>
                        {numberLabel(food.nutrients.calories)} kcal · Protein{' '}
                        {numberLabel(food.nutrients.proteinG)} g · Carbs{' '}
                        {numberLabel(food.nutrients.carbsG)} g · Fat{' '}
                        {numberLabel(food.nutrients.fatG)} g · Fibre{' '}
                        {food.missingNutrients?.includes('fibreG')
                          ? 'not supplied'
                          : `${numberLabel(food.nutrients.fibreG)} g`}{' '}
                        per serving
                      </FitnessText>
                      <FitnessAction
                        label={`Use catalogue food: ${food.name}`}
                        secondary
                        busy={mutation.isPending}
                        onPress={() => {
                          void importFood(food.barcode);
                        }}
                      />
                    </FitnessCard>
                  ))
                ) : (
                  <FitnessText muted>
                    No catalogue matches. Enter the package values as a private
                    custom food.
                  </FitnessText>
                )}
              </>
            )}
          </FitnessCard>
        )}
      {mode === 'Manual food' && (
        <FitnessCard>
          <FitnessSection
            title={
              estimate
                ? 'Review your editable estimate'
                : 'Use a label or your own entry'
            }
            caption="Values below are for one serving. No calories are inferred on your device."
          />
          <FitnessField
            label="Food name"
            value={manualName}
            onChangeText={setManualName}
          />
          <FitnessField
            label="Number of servings"
            value={servings}
            onChangeText={setServings}
            keyboardType="decimal-pad"
          />
          {nutrientKeys.map(key => (
            <FitnessField
              key={key}
              label={nutrientLabel[key]}
              value={nutrients[key]}
              keyboardType="decimal-pad"
              onChangeText={value =>
                setNutrients(n => ({ ...n, [key]: value }))
              }
            />
          ))}
          <FitnessAction
            label={
              estimate
                ? 'Accept edited estimate & add to meal'
                : 'Add manual food to meal'
            }
            onPress={addManual}
          />
          <FitnessField
            label="Serving name (for custom food)"
            value={servingName}
            onChangeText={setServingName}
          />
          <FitnessField
            label="Serving size (grams, for custom food)"
            value={servingGrams}
            onChangeText={setServingGrams}
            keyboardType="decimal-pad"
          />
          <FitnessAction
            label="Save as a private custom food"
            secondary
            busy={mutation.isPending}
            onPress={() => {
              void saveCustomFood();
            }}
          />
        </FitnessCard>
      )}
      {mode === 'Recipes' && (
        <>
          <FitnessCard>
            <FitnessField
              label="Recipe name"
              value={recipeName}
              onChangeText={setRecipeName}
            />
            <FitnessField
              label="Recipe yield (servings)"
              value={recipeServings}
              onChangeText={setRecipeServings}
              keyboardType="decimal-pad"
            />
            {recipeIngredients.map((ingredient, i) => (
              <FitnessCard key={i}>
                <FitnessText>
                  {ingredient.name} · {ingredient.servings} servings
                </FitnessText>
                <FitnessAction
                  label={`Remove ingredient ${i + 1}`}
                  secondary
                  onPress={() =>
                    setRecipeIngredients(items =>
                      items.filter((_, index) => index !== i),
                    )
                  }
                />
              </FitnessCard>
            ))}
            <FitnessAction
              label="Save private recipe"
              disabled={!recipeIngredients.length}
              busy={mutation.isPending}
              onPress={() => {
                void saveRecipe();
              }}
            />
          </FitnessCard>
          <FitnessSection title="Your recipes" />
          {recipes.isPending ? (
            <FitnessLoading />
          ) : recipes.isError ? (
            <FitnessNotice error message={recipes.error.message} />
          ) : recipes.data?.recipes.length ? (
            recipes.data.recipes.map(recipe => (
              <FitnessCard key={recipe.id}>
                <FitnessSection
                  title={recipe.name}
                  caption={`${recipe.servings} servings per recipe`}
                />
                <FitnessText muted>
                  {numberLabel(recipe.nutrients.calories)} kcal per serving
                </FitnessText>
                <FitnessAction
                  label={`Add a serving of ${recipe.name}`}
                  secondary
                  onPress={() => {
                    setEntries(items => [
                      ...items,
                      {
                        name: recipe.name,
                        servings: 1,
                        nutrients: recipe.nutrients,
                      },
                    ]);
                    setNotice('Recipe serving added to your meal draft.');
                  }}
                />
              </FitnessCard>
            ))
          ) : (
            <FitnessText muted>
              Your private recipes will appear here.
            </FitnessText>
          )}
        </>
      )}
      {mode === 'Photo' && (
        <FitnessCard>
          <FitnessSection
            title="A photo, if it helps"
            caption="Optional and private. A photo cannot confirm ingredients, portion size or allergens."
          />
          <FitnessAction
            label="Choose a meal photo"
            secondary
            icon="camera"
            onPress={() => {
              void choosePhoto();
            }}
          />
          {photo && (
            <>
              <FitnessText muted>
                Photo selected.{' '}
                {photo.id ? 'Private upload saved.' : 'Still on this device.'}
              </FitnessText>
              <FitnessAction
                label="Upload privately & attach to meal"
                secondary
                busy={uploading}
                onPress={() => {
                  void processPhoto(false);
                }}
              />
              <FitnessNotice message="AI estimation sends this meal photo to the configured AI service. Its output is uncertain, can miss allergens, and must be edited and confirmed before logging. This is optional." />
              <FitnessAction
                label="I agree: send photo for an AI estimate"
                busy={uploading}
                onPress={() => {
                  void processPhoto(true);
                }}
              />
              <FitnessAction
                label="Remove selected photo from draft"
                secondary
                disabled={uploading}
                onPress={() => {
                  setMediaIds(ids => ids.filter(id => id !== photo.id));
                  setPhoto(null);
                  setNotice(
                    'Photo detached from this draft. You can delete any uploaded copy from Privacy.',
                  );
                }}
              />
            </>
          )}
        </FitnessCard>
      )}
      <FitnessSection title={editing ? 'Edit saved meal' : 'Your meal draft'} />
      {entries.length ? (
        entries.map((entry, index) => (
          <FitnessCard key={index}>
            <FitnessText>
              {entry.name} · {entry.servings} servings
            </FitnessText>
            <FitnessField
              label={`Servings for ${entry.name}`}
              keyboardType="decimal-pad"
              value={entryText[`${index}:servings`] ?? String(entry.servings)}
              onChangeText={value => {
                setEntryText(values => ({
                  ...values,
                  [`${index}:servings`]: value,
                }));
                setEntries(items =>
                  items.map((item, i) =>
                    i === index ? { ...item, servings: Number(value) } : item,
                  ),
                );
              }}
            />
            {nutrientKeys.map(key => (
              <FitnessField
                key={key}
                label={`${entry.name}: ${nutrientLabel[key]} per serving`}
                keyboardType="decimal-pad"
                value={
                  entryText[`${index}:${key}`] ?? String(entry.nutrients[key])
                }
                onChangeText={value => {
                  setEntryText(values => ({
                    ...values,
                    [`${index}:${key}`]: value,
                  }));
                  setEntries(items =>
                    items.map((item, i) =>
                      i === index
                        ? {
                            ...item,
                            nutrients: {
                              ...item.nutrients,
                              [key]: Number(value),
                            },
                          }
                        : item,
                    ),
                  );
                }}
              />
            ))}
            <FitnessAction
              label={`Remove ${entry.name}`}
              secondary
              onPress={() => {
                setEntryText({});
                setEntries(items => items.filter((_, i) => i !== index));
              }}
            />
          </FitnessCard>
        ))
      ) : (
        <FitnessText muted>
          Add a food, recipe or edited estimate to begin.
        </FitnessText>
      )}
      {!!entries.length && (
        <FitnessCard tone="soft">
          <FitnessText>
            {numberLabel(totals.calories)} kcal · Protein{' '}
            {numberLabel(totals.proteinG)} g · Carbs{' '}
            {numberLabel(totals.carbsG)} g · Fat {numberLabel(totals.fatG)} g ·
            Fibre {numberLabel(totals.fibreG)} g
          </FitnessText>
          {estimate && (
            <FitnessText muted>Contains a reviewed estimate.</FitnessText>
          )}
        </FitnessCard>
      )}
      <FitnessField
        label="Meal notes (optional)"
        value={notes}
        onChangeText={setNotes}
        multiline
      />
      <FitnessNotice
        message={
          mediaIds.length
            ? `${mediaIds.length} private photo(s) attached.`
            : null
        }
      />
      <FitnessNotice error message={error} />
      <FitnessNotice message={notice} />
      {mediaIds.map(mediaId => (
        <FitnessPrivateMedia
          key={mediaId}
          mediaId={mediaId}
          compact
          onDelete={() => setMediaIds(ids => ids.filter(id => id !== mediaId))}
        />
      ))}
      <FitnessAction
        label={editing ? 'Save meal changes' : 'Save meal'}
        busy={mutation.isPending}
        disabled={uploading || !entries.length}
        onPress={() => {
          void saveMeal();
        }}
      />
      <FitnessSection title="Saved meals for this day" />
      {logs.isPending ? (
        <FitnessLoading />
      ) : logs.isError ? (
        <>
          <FitnessNotice error message={logs.error.message} />
          <FitnessAction
            label="Retry saved meals"
            secondary
            onPress={() => {
              void logs.refetch();
            }}
          />
        </>
      ) : logs.data?.logs.length ? (
        logs.data.logs.map(log => {
          const d = log.data as any;
          return (
            <FitnessCard key={log.id}>
              <FitnessSection
                title={d.mealType}
                caption={d.foods.map((food: any) => food.name).join(', ')}
              />
              {d.estimate && (
                <FitnessText muted>Contains an estimate</FitnessText>
              )}
              <FitnessAction
                label={`Edit ${d.mealType}`}
                secondary
                disabled={entries.length > 0 && editing !== log.id}
                onPress={() => {
                  setEditing(log.id);
                  setEntries(d.foods);
                  setNotes(d.notes ?? '');
                  setMealType(d.mealType);
                  setMediaIds(d.mediaIds ?? []);
                  setEstimate(Boolean(d.estimate));
                }}
              />
            </FitnessCard>
          );
        })
      ) : (
        <FitnessEmpty
          title="A fresh page"
          message="No meals recorded on this date."
        />
      )}
    </FitnessScreen>
  );
}
