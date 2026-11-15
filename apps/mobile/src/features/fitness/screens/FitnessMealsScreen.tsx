import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useFitnessDraftGuard } from '../logging/useFitnessDraftGuard';
import {
  Coffee,
  Sun,
  Utensils,
  Apple,
  Leaf,
  Wheat,
  Milk,
  Bean,
} from 'lucide-react-native';
import {
  FitnessChoiceCards,
  FitnessDatePicker,
  FitnessDisclosure,
  FitnessStepper,
} from '../components/FitnessControls';
import { FitnessPhoto } from '../components/FitnessVisuals';
import { FitnessMediaSourceSheet } from '../components/FitnessMediaSourceSheet';
import type { PickedFitnessMedia } from '../logging/fitnessMediaPicker';
import { useFitnessLoggingPreferences } from '../logging/fitnessLoggingPreferences';
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
  const preferences = useFitnessLoggingPreferences();
  const [mediaChooser, setMediaChooser] = useState(false),
    [manualDetailsOpen, setManualDetailsOpen] = useState(false);
  const recent = useFitnessQuery<{ logs: FitnessLog[] }>('/logs/meal');
  const library = useFitnessQuery<{ foods: FitnessFood[] }>('/foods');
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
  const draftState = {
    date,
    mealType,
    entries,
    notes,
    mediaIds,
    estimate,
    photo,
    manualName,
    servingName,
    servingGrams,
    servings,
    nutrients,
    manualFoodId,
    manualTarget,
    recipeName,
    recipeServings,
    recipeIngredients,
  };
  const snapshot = JSON.stringify(draftState);
  const savedSnapshot = useRef(snapshot);
  const manualSignature = JSON.stringify({
    manualName,
    servings,
    nutrients,
    manualFoodId,
    manualTarget,
  });
  const consumedManual = useRef(manualSignature);
  const hydrated = useRef(false);
  useEffect(() => {
    if (existing.data?.log && !hydrated.current) {
      const log = existing.data.log;
      const data = log.data as any;
      savedSnapshot.current = JSON.stringify({
        ...draftState,
        date: log.date,
        mealType: data.mealType,
        entries: data.foods,
        notes: data.notes ?? '',
        mediaIds: data.mediaIds ?? [],
        estimate: Boolean(data.estimate),
      });
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
    ) {
      setManualDetailsOpen(true);
      throw new Error(
        'Add all five package values. Use zero only when the label says zero.',
      );
    }
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
      if (guard.isActive()) setError((e as Error).message);
    }
  }
  async function importFood(barcode: string) {
    const assertActive = guard.captureOperation();
    if (!guard.isActive()) return false;
    setError('');
    try {
      assertActive();
      positiveServings();
      const response = await mutation.mutateAsync({
        path: '/foods/import',
        body: { barcode },
      });
      assertActive();
      addFood(response.food);
    } catch (e) {
      if (guard.isActive()) setError((e as Error).message);
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
      const count = positiveServings();
      const values = parsedNutrients();
      setEntries(items => [
        ...items,
        {
          ...(manualFoodId ? { foodId: manualFoodId } : {}),
          name: manualName.trim(),
          servings: count,
          nutrients: values,
        },
      ]);
      consumedManual.current = manualSignature;
      setNotice('Food added to your meal draft.');
    } catch (e) {
      if (guard.isActive()) setError((e as Error).message);
    }
  }
  async function saveCustomFood() {
    const assertActive = guard.captureOperation();
    if (!guard.isActive()) return false;
    setError('');
    try {
      assertActive();
      positiveServings();
      assertActive();
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
      assertActive();
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
      consumedManual.current = manualSignature;
      setNotice('Private custom food saved and added to your draft.');
    } catch (e) {
      if (guard.isActive()) setError((e as Error).message);
    }
  }
  async function saveRecipe(
    keepDraft = false,
    assertActive = guard.captureOperation(),
  ) {
    if (!guard.isActive()) return false;
    setError('');
    try {
      assertActive();
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
      assertActive();
      setNotice('Private recipe saved.');
      if (!keepDraft) {
        setRecipeName('');
        setRecipeIngredients([]);
        recipeRequest.current = { id: newFitnessRequestId(), signature: '' };
      }
      return true;
    } catch (e) {
      if (guard.isActive()) setError((e as Error).message);
      return false;
    }
  }
  async function saveMeal(
    foods = entries,
    selectedMediaIds = mediaIds,
    assertActive = guard.captureOperation(),
  ) {
    if (!guard.isActive()) return false;
    setError('');
    setNotice('');
    try {
      assertActive();
      if (!fitnessDateValid(date))
        throw new Error('Enter a valid date in YYYY-MM-DD format.');
      if (!foods.length)
        throw new Error('Add at least one food before saving.');
      if (
        foods.some(
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
        foods,
        notes,
        ...(selectedMediaIds.length ? { mediaIds: selectedMediaIds } : {}),
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
      assertActive();
      savedSnapshot.current = JSON.stringify({
        ...draftState,
        entries: [],
        notes: '',
        mediaIds: [],
        estimate: false,
        photo: null,
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
      return true;
    } catch (e) {
      if (guard.isActive()) setError((e as Error).message);
      return false;
    }
  }
  async function choosePhoto(asset: PickedFitnessMedia) {
    if (!guard.isActive()) return;
    setError('');
    setPhoto({
      uri: asset.uri,
      name: asset.name,
      type: asset.type,
      purpose: 'meal',
      clientRequestId: newFitnessRequestId(),
    });
    setNotice(
      'Photo selected on your device. Choose whether to upload privately or request an AI estimate.',
    );
  }
  async function processPhoto(
    ai: boolean,
    assertActive = guard.captureOperation(),
  ) {
    if (!guard.isActive()) return null;
    if (!photo) return null;
    setError('');
    setUploading(true);
    try {
      assertActive();
      const media = photo.id
        ? { id: photo.id }
        : await uploadFitnessMedia(photo);
      assertActive();
      setPhoto(p => (p ? { ...p, id: media.id } : p));
      setMediaIds(ids => [...new Set([...ids, media.id])]);
      if (ai) {
        assertActive();
        const response = await mutation.mutateAsync({
          path: '/meals/estimate',
          body: { mediaId: media.id, consentToAI: true },
        });
        assertActive();
        const value = response.estimate;
        setManualTarget('meal');
        setManualFoodId(undefined);
        setManualName(value.label);
        setNutrients(
          Object.fromEntries(
            nutrientKeys.map(key => [
              key,
              value[key] === undefined || value[key] === null
                ? ''
                : String(value[key]),
            ]),
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
      return media.id;
    } catch (e) {
      if (guard.isActive()) setError((e as Error).message);
      return null;
    } finally {
      if (guard.isActive()) setUploading(false);
    }
  }
  async function saveForExit() {
    const assertActive = guard.captureOperation();
    if (!guard.isActive()) return false;
    setError('');
    try {
      assertActive();
      let foods = entries;
      if (manualSignature !== consumedManual.current) {
        if (manualTarget === 'recipe')
          throw new Error(
            'Save this reviewed ingredient into your recipe before leaving.',
          );
        if (!manualName.trim())
          throw new Error('Name your custom food before saving.');
        const values = parsedNutrients(),
          count = positiveServings();
        foods = [
          ...foods,
          {
            ...(manualFoodId ? { foodId: manualFoodId } : {}),
            name: manualName.trim(),
            servings: count,
            nutrients: values,
          },
        ];
      }
      const recipeDraft = Boolean(
        recipeName.trim() || recipeIngredients.length,
      );
      if (recipeDraft && (!recipeName.trim() || !recipeIngredients.length))
        throw new Error(
          'Name your recipe and add an ingredient before saving.',
        );
      if ((!foods.length && !recipeDraft) || (photo && !foods.length))
        throw new Error(
          photo
            ? 'Add a food before saving your meal. Your selected photo is still here.'
            : 'Add a food before saving.',
        );
      if (
        foods.some(
          food =>
            !Number.isFinite(food.servings) ||
            food.servings <= 0 ||
            nutrientKeys.some(
              key =>
                !Number.isFinite(food.nutrients[key]) ||
                food.nutrients[key] < 0,
            ),
        )
      )
        throw new Error(
          'Review the servings and package values before saving.',
        );
      if (recipeDraft) {
        const saved = await saveRecipe(true, assertActive);
        assertActive();
        if (!saved) return false;
      }
      let ids = mediaIds;
      if (photo) {
        const id = await processPhoto(false, assertActive);
        assertActive();
        if (!id) return false;
        ids = [...new Set([...ids, id])];
      }
      if (!foods.length) return true;
      assertActive();
      return saveMeal(foods, ids, assertActive);
    } catch (problem) {
      if (guard.isActive()) setError((problem as Error).message);
      return false;
    }
  }
  const guard = useFitnessDraftGuard({
    dirty: snapshot !== savedSnapshot.current,
    busy: mutation.isPending || uploading,
    save: saveForExit,
    detail: photo
      ? 'Save your entries and selected photos privately. Photos are not sent to AI.'
      : undefined,
    onError: setError,
  });
  const portionOptions = ['½', '1', '1½', '2'];
  const portionValue = (value: string) =>
    ({ '½': 0.5, '1': 1, '1½': 1.5, '2': 2 }[value] ?? 1);
  const portionLabel = (value: number) =>
    value === 0.5 ? '½' : value === 1.5 ? '1½' : String(value);
  const favourites = (library.data?.foods ?? []).filter(food =>
    preferences.favouriteFoodIds.includes(food.id),
  );
  const recentMeals = (recent.data?.logs ?? [])
    .filter(
      (log, index, all) =>
        index ===
        all.findIndex(
          other =>
            JSON.stringify((other.data as any).foods) ===
            JSON.stringify((log.data as any).foods),
        ),
    )
    .slice(0, 4);
  const existingBusy = Boolean(
    route.params?.logId && (existing.isPending || existing.isError),
  );
  const changeNutrient = (key: keyof FitnessNutrients, value: number) =>
    setNutrients(n => ({ ...n, [key]: String(value) }));
  const servingControl = (
    <>
      <FitnessChoices
        label="Servings"
        options={portionOptions}
        selected={portionLabel(Number(servings))}
        onChange={value => setServings(String(portionValue(value)))}
      />
      <FitnessStepper
        label="Portion size"
        value={Number(servings)}
        min={0.1}
        max={100}
        step={0.5}
        unit="servings"
        onChange={value => setServings(String(value))}
      />
    </>
  );
  function renderFood(food: FitnessFood) {
    return (
      <FitnessCard key={food.id}>
        <FitnessSection
          title={food.name}
          caption={`${food.servingName} · ${food.servingGrams} g`}
        />
        <FitnessText muted>
          {food.missingNutrients?.includes('calories')
            ? 'Calories need review'
            : `${numberLabel(food.nutrients.calories)} kcal per serving`}
        </FitnessText>
        <FitnessAction
          label={`Add ${food.name}`}
          secondary
          onPress={() => addFood(food)}
        />
        <FitnessAction
          label={
            preferences.favouriteFoodIds.includes(food.id)
              ? `Unfavourite ${food.name}`
              : `Favourite ${food.name}`
          }
          icon="star"
          secondary
          onPress={() => preferences.toggleFavourite(food.id)}
        />
      </FitnessCard>
    );
  }
  return (
    <FitnessScreen
      title={editing ? 'Edit your meal' : 'Add a meal'}
      busy={mutation.isPending || uploading || guard.saving}
      footer={
        !existingBusy ? (
          <FitnessAction
            label={editing ? 'Save meal changes' : 'Save meal'}
            busy={mutation.isPending}
            disabled={uploading || !entries.length}
            onPress={() => {
              void saveMeal();
            }}
          />
        ) : undefined
      }
    >
      {route.params?.logId && existing.isPending ? (
        <FitnessLoading />
      ) : existing.isError ? (
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
      ) : (
        <>
          <FitnessPhoto kind="food" label="Food and everyday nutrition">
            <FitnessSection
              title="A little nourishment"
              caption="Choose your meal, then add what you ate."
            />
          </FitnessPhoto>
          <FitnessChoiceCards
            options={[
              { value: 'breakfast', label: 'Breakfast', icon: Coffee },
              { value: 'lunch', label: 'Lunch', icon: Sun },
              { value: 'dinner', label: 'Dinner', icon: Utensils },
              { value: 'snack', label: 'Snack', icon: Apple },
            ]}
            value={[mealType]}
            onChange={values => setMealType(values[0] ?? 'breakfast')}
          />
          {!!entries.length && (
            <>
              <FitnessSection
                title="Your meal"
                caption={`${entries.length} foods · ${numberLabel(
                  totals.calories,
                )} kcal`}
              />
              {entries.map((entry, index) => (
                <FitnessCard key={index}>
                  <FitnessSection
                    title={entry.name}
                    caption={`${numberLabel(
                      entry.nutrients.calories * entry.servings,
                    )} kcal`}
                  />
                  <FitnessChoices
                    label={`Servings for ${entry.name}`}
                    options={portionOptions}
                    selected={portionLabel(entry.servings)}
                    onChange={value => {
                      setEntryText(text => ({
                        ...text,
                        [`${index}:servings`]: String(portionValue(value)),
                      }));
                      setEntries(items =>
                        items.map((item, i) =>
                          i === index
                            ? { ...item, servings: portionValue(value) }
                            : item,
                        ),
                      );
                    }}
                  />
                  <FitnessStepper
                    label={`Portion for ${entry.name}`}
                    value={entry.servings}
                    min={0.1}
                    max={100}
                    step={0.5}
                    unit="servings"
                    onChange={value => {
                      setEntryText(text => ({
                        ...text,
                        [`${index}:servings`]: String(value),
                      }));
                      setEntries(items =>
                        items.map((item, i) =>
                          i === index ? { ...item, servings: value } : item,
                        ),
                      );
                    }}
                  />
                  <FitnessDisclosure
                    title="Nutrition & food options"
                    subtitle="Per-serving values"
                  >
                    {nutrientKeys.map(key => (
                      <FitnessStepper
                        key={key}
                        label={`${entry.name}: ${nutrientLabel[key]} per serving`}
                        value={entry.nutrients[key]}
                        min={0}
                        max={key === 'calories' ? 20000 : 1000}
                        step={key === 'calories' ? 10 : 1}
                        onChange={value => {
                          setEntryText(text => ({
                            ...text,
                            [`${index}:${key}`]: String(value),
                          }));
                          setEntries(items =>
                            items.map((item, i) =>
                              i === index
                                ? {
                                    ...item,
                                    nutrients: {
                                      ...item.nutrients,
                                      [key]: value,
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
                        setEntries(items =>
                          items.filter((_, i) => i !== index),
                        );
                      }}
                    />
                  </FitnessDisclosure>
                </FitnessCard>
              ))}
            </>
          )}
          <FitnessSection title="Find something to add" />
          <FitnessField
            label="Search foods"
            value={search}
            onChangeText={setSearch}
            placeholder="Search your library or a package"
            returnKeyType="search"
            onSubmitEditing={() => setQueryText(search)}
          />
          <FitnessAction
            label="Search foods"
            secondary
            onPress={() => setQueryText(search)}
          />
          {!queryText && (
            <>
              {!!favourites.length && (
                <FitnessDisclosure
                  title="Your favourites"
                  subtitle={`${favourites.length} foods · this session`}
                  defaultOpen
                >
                  {favourites.map(renderFood)}
                </FitnessDisclosure>
              )}
              {!!recentMeals.length && (
                <FitnessDisclosure
                  title="Recent meals"
                  subtitle="Use the foods as an editable starting point"
                  defaultOpen
                >
                  {recentMeals.map(log => {
                    const data = log.data as any;
                    return (
                      <FitnessCard key={log.id}>
                        <FitnessSection
                          title={data.foods
                            .map((food: any) => food.name)
                            .join(', ')}
                          caption={new Date(
                            `${log.date}T12:00:00`,
                          ).toLocaleDateString()}
                        />
                        <FitnessAction
                          label={`Use foods from ${data.mealType}`}
                          secondary
                          onPress={() => {
                            setEntries(items => [
                              ...items,
                              ...data.foods.map((food: FoodEntry) => ({
                                ...food,
                                nutrients: { ...food.nutrients },
                              })),
                            ]);
                            setEstimate(
                              current => current || Boolean(data.estimate),
                            );
                            setNotice(
                              'Foods added to your draft. Adjust portions before saving.',
                            );
                          }}
                        />
                      </FitnessCard>
                    );
                  })}
                </FitnessDisclosure>
              )}
              <FitnessSection title="Explore food categories" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingBottom: 4 }}
                accessibilityLabel="Browse food categories"
              >
                {(
                  [
                    { value: 'vegetables', label: 'Vegetables', photo: 'food' },
                    { value: 'fruit', label: 'Fruit', photo: 'fruit' },
                    { value: 'grains', label: 'Grains', photo: 'grains' },
                    { value: 'protein', label: 'Protein', photo: 'protein' },
                  ] as const
                ).map(category => (
                  <Pressable
                    key={category.value}
                    accessibilityRole="button"
                    accessibilityLabel={`Browse ${category.label}`}
                    onPress={() => {
                      setSearch(category.value);
                      setQueryText(category.value);
                    }}
                    style={{ width: 100, gap: 8, minHeight: 110 }}
                  >
                    <FitnessPhoto
                      kind={category.photo}
                      style={{ height: 78, borderRadius: 18 }}
                    />
                    <FitnessText>{category.label}</FitnessText>
                  </Pressable>
                ))}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Browse Dairy"
                  onPress={() => {
                    setSearch('dairy');
                    setQueryText('dairy');
                  }}
                  style={{ width: 100, gap: 8, minHeight: 110 }}
                >
                  <View
                    style={{
                      height: 78,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Milk size={32} color="#708B76" />
                  </View>
                  <FitnessText>Dairy</FitnessText>
                </Pressable>
              </ScrollView>
            </>
          )}
          {!!queryText && (
            <FitnessCard>
              <FitnessSection title="Search results" />
              {servingControl}
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
                foodsQuery.data.foods.map(renderFood)
              ) : (
                <FitnessText muted>No matches in your saved foods.</FitnessText>
              )}
              {queryText.trim().length >= 2 && (
                <FitnessDisclosure
                  title="Food catalogue"
                  subtitle="Open Food Facts · check the package"
                  defaultOpen
                >
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
                    </>
                  ) : (
                    <>
                      <FitnessText muted>
                        Estimates, not verified ingredients or allergens.
                        Missing values need your review.
                      </FitnessText>
                      {catalogue.data?.foods.map(food => (
                        <FitnessCard key={food.barcode}>
                          <FitnessSection
                            title={food.name}
                            caption={`${food.servingName} · ${
                              food.missingNutrients?.includes('calories')
                                ? 'Calories need review'
                                : `${numberLabel(food.nutrients.calories)} kcal`
                            }`}
                          />
                          <FitnessAction
                            label={`Use catalogue food: ${food.name}`}
                            secondary
                            busy={mutation.isPending}
                            onPress={() => {
                              void importFood(food.barcode);
                            }}
                          />
                        </FitnessCard>
                      ))}
                      {!catalogue.data?.foods.length && (
                        <FitnessText muted>
                          No catalogue matches. Add custom food below.
                        </FitnessText>
                      )}
                      <FitnessDisclosure title="Data source">
                        <FitnessText muted>
                          {catalogue.data?.notice ?? 'Open Food Facts · ODbL'}
                        </FitnessText>
                      </FitnessDisclosure>
                    </>
                  )}
                </FitnessDisclosure>
              )}
              <FitnessAction
                label="Clear search"
                secondary
                onPress={() => {
                  setSearch('');
                  setQueryText('');
                }}
              />
            </FitnessCard>
          )}
          <FitnessDisclosure
            key={mode === 'Manual food' ? 'review-food' : 'custom-food'}
            title={estimate ? 'Review your food estimate' : 'Add custom food'}
            subtitle="Use your package label"
            defaultOpen={mode === 'Manual food'}
          >
            {estimate && (
              <FitnessNotice message="Review every value. Estimates cannot confirm allergens or medical suitability." />
            )}
            <FitnessField
              label="Food name"
              value={manualName}
              onChangeText={setManualName}
            />
            {servingControl}
            <FitnessStepper
              label={nutrientLabel.calories}
              value={
                nutrients.calories === ''
                  ? undefined
                  : Number(nutrients.calories)
              }
              min={0}
              max={20000}
              step={10}
              onChange={value => changeNutrient('calories', value)}
            />
            <FitnessDisclosure
              key={String(manualDetailsOpen || estimate)}
              title="Nutrition details"
              subtitle="All package values are needed; nothing is filled in for you."
              defaultOpen={manualDetailsOpen || estimate}
            >
              {nutrientKeys
                .filter(key => key !== 'calories')
                .map(key => (
                  <FitnessStepper
                    key={key}
                    label={nutrientLabel[key]}
                    value={
                      nutrients[key] === '' ? undefined : Number(nutrients[key])
                    }
                    min={0}
                    max={1000}
                    step={1}
                    onChange={value => changeNutrient(key, value)}
                  />
                ))}
            </FitnessDisclosure>
            <FitnessAction
              label={
                estimate
                  ? 'Accept edited estimate & add to meal'
                  : 'Add manual food to meal'
              }
              secondary
              onPress={addManual}
            />
            <FitnessDisclosure title="Save in my food library">
              <FitnessField
                label="Serving name"
                value={servingName}
                onChangeText={setServingName}
              />
              <FitnessStepper
                label="Serving weight"
                value={servingGrams === '' ? undefined : Number(servingGrams)}
                min={1}
                max={10000}
                step={5}
                unit="g"
                onChange={value => setServingGrams(String(value))}
              />
              <FitnessAction
                label="Save as a private custom food"
                secondary
                busy={mutation.isPending}
                onPress={() => {
                  void saveCustomFood();
                }}
              />
            </FitnessDisclosure>
          </FitnessDisclosure>
          <FitnessDisclosure
            key={mode === 'Recipes' ? 'recipes-open' : 'recipes-closed'}
            title="My recipes"
            subtitle="Your own saved recipes"
            defaultOpen={mode === 'Recipes'}
          >
            <FitnessAction
              label="Create a recipe"
              secondary
              onPress={() => setMode('Recipes')}
            />
            {mode === 'Recipes' && (
              <FitnessCard>
                <FitnessField
                  label="Recipe name"
                  value={recipeName}
                  onChangeText={setRecipeName}
                />
                <FitnessStepper
                  label="Recipe yield"
                  value={Number(recipeServings)}
                  min={0.5}
                  max={100}
                  step={0.5}
                  unit="servings"
                  onChange={value => setRecipeServings(String(value))}
                />
                <FitnessText muted>
                  Search above to add saved foods as ingredients.
                </FitnessText>
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
                  secondary
                  disabled={!recipeIngredients.length}
                  busy={mutation.isPending}
                  onPress={() => {
                    void saveRecipe();
                  }}
                />
                <FitnessAction
                  label="Back to meal"
                  secondary
                  onPress={() => setMode('Journal')}
                />
              </FitnessCard>
            )}
            {recipes.isPending ? (
              <FitnessLoading />
            ) : recipes.isError ? (
              <>
                <FitnessNotice error message={recipes.error.message} />
                <FitnessAction
                  label="Retry recipes"
                  secondary
                  onPress={() => {
                    void recipes.refetch();
                  }}
                />
              </>
            ) : recipes.data?.recipes.length ? (
              recipes.data.recipes.map(recipe => (
                <FitnessCard key={recipe.id}>
                  <FitnessSection
                    title={recipe.name}
                    caption={`${numberLabel(
                      recipe.nutrients.calories,
                    )} kcal per serving`}
                  />
                  <FitnessAction
                    label={`Add a serving of ${recipe.name}`}
                    secondary
                    onPress={() => {
                      setEntries(items => [
                        ...items,
                        {
                          name: recipe.name,
                          servings: 1,
                          nutrients: { ...recipe.nutrients },
                        },
                      ]);
                      setNotice('Recipe serving added.');
                    }}
                  />
                </FitnessCard>
              ))
            ) : (
              <FitnessText muted>No saved recipes yet.</FitnessText>
            )}
          </FitnessDisclosure>
          <FitnessDisclosure
            title="Add a private meal photo"
            subtitle="Optional · camera or gallery"
          >
            <FitnessAction
              label="Choose a meal photo"
              icon="camera"
              secondary
              onPress={() => setMediaChooser(true)}
            />
            {photo && (
              <>
                <FitnessText muted>
                  {photo.id
                    ? 'Private photo uploaded.'
                    : 'Photo selected on this device.'}
                </FitnessText>
                <FitnessAction
                  label="Upload privately & attach to meal"
                  secondary
                  busy={uploading}
                  onPress={() => {
                    void processPhoto(false);
                  }}
                />
                <FitnessDisclosure title="Optional AI estimate">
                  <FitnessNotice message="This sends your photo to the configured AI service. Estimates can miss ingredients and allergens. Review and confirm every value before logging." />
                  <FitnessAction
                    label="I agree: send photo for an AI estimate"
                    secondary
                    busy={uploading}
                    onPress={() => {
                      void processPhoto(true);
                    }}
                  />
                </FitnessDisclosure>
                <FitnessAction
                  label="Remove selected photo from draft"
                  secondary
                  disabled={uploading}
                  onPress={() => {
                    setMediaIds(ids => ids.filter(id => id !== photo.id));
                    setPhoto(null);
                    setNotice(
                      'Photo detached. Delete any uploaded copy in Privacy.',
                    );
                  }}
                />
              </>
            )}
            {mediaIds.map(mediaId => (
              <FitnessPrivateMedia
                key={mediaId}
                mediaId={mediaId}
                compact
                onDelete={() =>
                  setMediaIds(ids => ids.filter(id => id !== mediaId))
                }
              />
            ))}
          </FitnessDisclosure>
          <FitnessDisclosure
            title="Meal details"
            subtitle={new Date(`${date}T12:00:00`).toLocaleDateString()}
          >
            {editing ? (
              <FitnessText muted>Recorded {date}</FitnessText>
            ) : (
              <FitnessDatePicker
                label="Meal date"
                value={date}
                onChange={setDate}
                maximumDate={new Date()}
              />
            )}
            <FitnessField
              label="Meal notes · optional"
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </FitnessDisclosure>
          <FitnessDisclosure
            title="Meals saved on this date"
            subtitle={
              logs.data ? `${logs.data.logs.length} entries` : undefined
            }
          >
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
                    <FitnessAction
                      label={`Edit ${d.mealType}`}
                      secondary
                      disabled={entries.length > 0 && editing !== log.id}
                      onPress={() => {
                        setEditing(log.id);
                        setEntries(
                          d.foods.map((food: FoodEntry) => ({
                            ...food,
                            nutrients: { ...food.nutrients },
                          })),
                        );
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
              <FitnessText muted>No saved meals for this date.</FitnessText>
            )}
          </FitnessDisclosure>
          <FitnessNotice error message={error} />
          <FitnessNotice message={notice} />
        </>
      )}
      <FitnessMediaSourceSheet
        visible={mediaChooser}
        onClose={() => setMediaChooser(false)}
        onChoose={asset => {
          void choosePhoto(asset);
        }}
      />
    </FitnessScreen>
  );
}
