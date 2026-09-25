export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string;
          household_id: string;
          icon: string;
          id: string;
          legacy_id: number | null;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          household_id: string;
          icon?: string;
          id?: string;
          legacy_id?: number | null;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          household_id?: string;
          icon?: string;
          id?: string;
          legacy_id?: number | null;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'categories_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
        ];
      };
      favorites: {
        Row: {
          created_at: string;
          household_id: string;
          recipe_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          household_id: string;
          recipe_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          household_id?: string;
          recipe_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'favorites_recipe_id_household_id_fkey';
            columns: ['recipe_id', 'household_id'];
            isOneToOne: false;
            referencedRelation: 'recipes';
            referencedColumns: ['id', 'household_id'];
          },
          {
            foreignKeyName: 'favorites_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      household_invites: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          created_by: string | null;
          email: string | null;
          expires_at: string;
          household_id: string;
          id: string;
          revoked_at: string | null;
          role: Database['public']['Enums']['household_role'];
          token_hash: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          expires_at?: string;
          household_id: string;
          id?: string;
          revoked_at?: string | null;
          role?: Database['public']['Enums']['household_role'];
          token_hash: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          expires_at?: string;
          household_id?: string;
          id?: string;
          revoked_at?: string | null;
          role?: Database['public']['Enums']['household_role'];
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'household_invites_accepted_by_fkey';
            columns: ['accepted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'household_invites_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'household_invites_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
        ];
      };
      household_members: {
        Row: {
          household_id: string;
          invited_by: string | null;
          joined_at: string;
          role: Database['public']['Enums']['household_role'];
          user_id: string;
        };
        Insert: {
          household_id: string;
          invited_by?: string | null;
          joined_at?: string;
          role?: Database['public']['Enums']['household_role'];
          user_id: string;
        };
        Update: {
          household_id?: string;
          invited_by?: string | null;
          joined_at?: string;
          role?: Database['public']['Enums']['household_role'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'household_members_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'household_members_invited_by_fkey';
            columns: ['invited_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'household_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      households: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'households_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      people: {
        Row: {
          bio: string | null;
          birth_year: number | null;
          created_at: string;
          created_by: string | null;
          death_year: number | null;
          household_id: string;
          id: string;
          name: string;
          relation: string | null;
          updated_at: string;
        };
        Insert: {
          bio?: string | null;
          birth_year?: number | null;
          created_at?: string;
          created_by?: string | null;
          death_year?: number | null;
          household_id: string;
          id?: string;
          name: string;
          relation?: string | null;
          updated_at?: string;
        };
        Update: {
          bio?: string | null;
          birth_year?: number | null;
          created_at?: string;
          created_by?: string | null;
          death_year?: number | null;
          household_id?: string;
          id?: string;
          name?: string;
          relation?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'people_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'people_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          created_at: string;
          display_name: string;
          id: string;
          locale: string;
          updated_at: string;
        };
        Insert: {
          avatar_path?: string | null;
          created_at?: string;
          display_name: string;
          id: string;
          locale?: string;
          updated_at?: string;
        };
        Update: {
          avatar_path?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          locale?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      recipe_ingredients: {
        Row: {
          household_id: string;
          id: string;
          is_optional: boolean;
          is_scalable: boolean;
          name: string;
          name_normalized: string | null;
          original_text: string | null;
          position: number;
          preparation: string | null;
          quantity: number | null;
          quantity_max: number | null;
          recipe_id: string;
          section: string | null;
          unit: string | null;
          unit_code: string | null;
        };
        Insert: {
          household_id: string;
          id?: string;
          is_optional?: boolean;
          is_scalable?: boolean;
          name: string;
          name_normalized?: never;
          original_text?: string | null;
          position: number;
          preparation?: string | null;
          quantity?: number | null;
          quantity_max?: number | null;
          recipe_id: string;
          section?: string | null;
          unit?: string | null;
          unit_code?: string | null;
        };
        Update: {
          household_id?: string;
          id?: string;
          is_optional?: boolean;
          is_scalable?: boolean;
          name?: string;
          name_normalized?: never;
          original_text?: string | null;
          position?: number;
          preparation?: string | null;
          quantity?: number | null;
          quantity_max?: number | null;
          recipe_id?: string;
          section?: string | null;
          unit?: string | null;
          unit_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'recipe_ingredients_recipe_id_household_id_fkey';
            columns: ['recipe_id', 'household_id'];
            isOneToOne: false;
            referencedRelation: 'recipes';
            referencedColumns: ['id', 'household_id'];
          },
          {
            foreignKeyName: 'recipe_ingredients_unit_code_fkey';
            columns: ['unit_code'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['code'];
          },
        ];
      };
      recipe_media: {
        Row: {
          approx_year: number | null;
          byte_size: number | null;
          caption: string | null;
          created_at: string;
          created_by: string | null;
          height: number | null;
          household_id: string;
          id: string;
          is_cover: boolean;
          kind: Database['public']['Enums']['media_kind'];
          legacy_path: string | null;
          mime_type: string;
          position: number;
          recipe_id: string;
          storage_path: string;
          story_id: string | null;
          width: number | null;
        };
        Insert: {
          approx_year?: number | null;
          byte_size?: number | null;
          caption?: string | null;
          created_at?: string;
          created_by?: string | null;
          height?: number | null;
          household_id: string;
          id?: string;
          is_cover?: boolean;
          kind?: Database['public']['Enums']['media_kind'];
          legacy_path?: string | null;
          mime_type: string;
          position?: number;
          recipe_id: string;
          storage_path: string;
          story_id?: string | null;
          width?: number | null;
        };
        Update: {
          approx_year?: number | null;
          byte_size?: number | null;
          caption?: string | null;
          created_at?: string;
          created_by?: string | null;
          height?: number | null;
          household_id?: string;
          id?: string;
          is_cover?: boolean;
          kind?: Database['public']['Enums']['media_kind'];
          legacy_path?: string | null;
          mime_type?: string;
          position?: number;
          recipe_id?: string;
          storage_path?: string;
          story_id?: string | null;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'recipe_media_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recipe_media_recipe_id_household_id_fkey';
            columns: ['recipe_id', 'household_id'];
            isOneToOne: false;
            referencedRelation: 'recipes';
            referencedColumns: ['id', 'household_id'];
          },
          {
            foreignKeyName: 'recipe_media_story_id_household_id_fkey';
            columns: ['story_id', 'household_id'];
            isOneToOne: false;
            referencedRelation: 'recipe_stories';
            referencedColumns: ['id', 'household_id'];
          },
        ];
      };
      recipe_notes: {
        Row: {
          body: string;
          created_at: string;
          household_id: string;
          id: string;
          recipe_id: string;
          updated_at: string;
          user_id: string;
          visibility: Database['public']['Enums']['note_visibility'];
        };
        Insert: {
          body: string;
          created_at?: string;
          household_id: string;
          id?: string;
          recipe_id: string;
          updated_at?: string;
          user_id: string;
          visibility?: Database['public']['Enums']['note_visibility'];
        };
        Update: {
          body?: string;
          created_at?: string;
          household_id?: string;
          id?: string;
          recipe_id?: string;
          updated_at?: string;
          user_id?: string;
          visibility?: Database['public']['Enums']['note_visibility'];
        };
        Relationships: [
          {
            foreignKeyName: 'recipe_notes_recipe_id_household_id_fkey';
            columns: ['recipe_id', 'household_id'];
            isOneToOne: false;
            referencedRelation: 'recipes';
            referencedColumns: ['id', 'household_id'];
          },
          {
            foreignKeyName: 'recipe_notes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      recipe_steps: {
        Row: {
          body: string;
          household_id: string;
          id: string;
          position: number;
          recipe_id: string;
          section: string | null;
          timer_seconds: number | null;
        };
        Insert: {
          body: string;
          household_id: string;
          id?: string;
          position: number;
          recipe_id: string;
          section?: string | null;
          timer_seconds?: number | null;
        };
        Update: {
          body?: string;
          household_id?: string;
          id?: string;
          position?: number;
          recipe_id?: string;
          section?: string | null;
          timer_seconds?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'recipe_steps_recipe_id_household_id_fkey';
            columns: ['recipe_id', 'household_id'];
            isOneToOne: false;
            referencedRelation: 'recipes';
            referencedColumns: ['id', 'household_id'];
          },
        ];
      };
      recipe_stories: {
        Row: {
          approx_year: number | null;
          body: string;
          created_at: string;
          created_by: string | null;
          historical_context: string | null;
          household_id: string;
          id: string;
          person_id: string | null;
          position: number;
          recipe_id: string;
          title: string | null;
          told_by: string | null;
          updated_at: string;
        };
        Insert: {
          approx_year?: number | null;
          body: string;
          created_at?: string;
          created_by?: string | null;
          historical_context?: string | null;
          household_id: string;
          id?: string;
          person_id?: string | null;
          position?: number;
          recipe_id: string;
          title?: string | null;
          told_by?: string | null;
          updated_at?: string;
        };
        Update: {
          approx_year?: number | null;
          body?: string;
          created_at?: string;
          created_by?: string | null;
          historical_context?: string | null;
          household_id?: string;
          id?: string;
          person_id?: string | null;
          position?: number;
          recipe_id?: string;
          title?: string | null;
          told_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'recipe_stories_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recipe_stories_person_id_household_id_fkey';
            columns: ['person_id', 'household_id'];
            isOneToOne: false;
            referencedRelation: 'people';
            referencedColumns: ['id', 'household_id'];
          },
          {
            foreignKeyName: 'recipe_stories_recipe_id_household_id_fkey';
            columns: ['recipe_id', 'household_id'];
            isOneToOne: false;
            referencedRelation: 'recipes';
            referencedColumns: ['id', 'household_id'];
          },
        ];
      };
      recipe_tags: {
        Row: {
          household_id: string;
          recipe_id: string;
          tag_id: string;
        };
        Insert: {
          household_id: string;
          recipe_id: string;
          tag_id: string;
        };
        Update: {
          household_id?: string;
          recipe_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'recipe_tags_recipe_id_household_id_fkey';
            columns: ['recipe_id', 'household_id'];
            isOneToOne: false;
            referencedRelation: 'recipes';
            referencedColumns: ['id', 'household_id'];
          },
          {
            foreignKeyName: 'recipe_tags_tag_id_household_id_fkey';
            columns: ['tag_id', 'household_id'];
            isOneToOne: false;
            referencedRelation: 'tags';
            referencedColumns: ['id', 'household_id'];
          },
        ];
      };
      recipe_versions: {
        Row: {
          created_at: string;
          created_by: string | null;
          household_id: string;
          id: string;
          recipe_id: string;
          snapshot: NonNullable<Json>;
          version: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          household_id: string;
          id?: string;
          recipe_id: string;
          snapshot: NonNullable<Json>;
          version: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          household_id?: string;
          id?: string;
          recipe_id?: string;
          snapshot?: NonNullable<Json>;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'recipe_versions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recipe_versions_recipe_id_household_id_fkey';
            columns: ['recipe_id', 'household_id'];
            isOneToOne: false;
            referencedRelation: 'recipes';
            referencedColumns: ['id', 'household_id'];
          },
        ];
      };
      recipes: {
        Row: {
          archived_at: string | null;
          category_id: string | null;
          cook_minutes: number | null;
          created_at: string;
          created_by: string | null;
          cuisine: string | null;
          description: string | null;
          difficulty: Database['public']['Enums']['recipe_difficulty'] | null;
          household_id: string;
          id: string;
          legacy_author: string | null;
          legacy_category_icon: string | null;
          legacy_id: number | null;
          legacy_last_modified: string | null;
          meal_types: string[];
          notes: string | null;
          origin_person_id: string | null;
          origin_text: string | null;
          origin_year: number | null;
          origin_year_approx: boolean;
          prep_minutes: number | null;
          search_vector: unknown;
          servings: number | null;
          source_name: string | null;
          source_text: string | null;
          source_type: Database['public']['Enums']['recipe_source_type'];
          source_url: string | null;
          title: string;
          total_minutes: number | null;
          updated_at: string;
          updated_by: string | null;
          version: number;
          yield_unit: string | null;
        };
        Insert: {
          archived_at?: string | null;
          category_id?: string | null;
          cook_minutes?: number | null;
          created_at?: string;
          created_by?: string | null;
          cuisine?: string | null;
          description?: string | null;
          difficulty?: Database['public']['Enums']['recipe_difficulty'] | null;
          household_id: string;
          id?: string;
          legacy_author?: string | null;
          legacy_category_icon?: string | null;
          legacy_id?: number | null;
          legacy_last_modified?: string | null;
          meal_types?: string[];
          notes?: string | null;
          origin_person_id?: string | null;
          origin_text?: string | null;
          origin_year?: number | null;
          origin_year_approx?: boolean;
          prep_minutes?: number | null;
          search_vector?: unknown;
          servings?: number | null;
          source_name?: string | null;
          source_text?: string | null;
          source_type?: Database['public']['Enums']['recipe_source_type'];
          source_url?: string | null;
          title: string;
          total_minutes?: number | null;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
          yield_unit?: string | null;
        };
        Update: {
          archived_at?: string | null;
          category_id?: string | null;
          cook_minutes?: number | null;
          created_at?: string;
          created_by?: string | null;
          cuisine?: string | null;
          description?: string | null;
          difficulty?: Database['public']['Enums']['recipe_difficulty'] | null;
          household_id?: string;
          id?: string;
          legacy_author?: string | null;
          legacy_category_icon?: string | null;
          legacy_id?: number | null;
          legacy_last_modified?: string | null;
          meal_types?: string[];
          notes?: string | null;
          origin_person_id?: string | null;
          origin_text?: string | null;
          origin_year?: number | null;
          origin_year_approx?: boolean;
          prep_minutes?: number | null;
          search_vector?: unknown;
          servings?: number | null;
          source_name?: string | null;
          source_text?: string | null;
          source_type?: Database['public']['Enums']['recipe_source_type'];
          source_url?: string | null;
          title?: string;
          total_minutes?: number | null;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
          yield_unit?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'recipes_category_id_household_id_fkey';
            columns: ['category_id', 'household_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id', 'household_id'];
          },
          {
            foreignKeyName: 'recipes_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recipes_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recipes_origin_person_id_household_id_fkey';
            columns: ['origin_person_id', 'household_id'];
            isOneToOne: false;
            referencedRelation: 'people';
            referencedColumns: ['id', 'household_id'];
          },
          {
            foreignKeyName: 'recipes_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      tags: {
        Row: {
          created_at: string;
          household_id: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          household_id: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          household_id?: string;
          id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tags_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
        ];
      };
      units: {
        Row: {
          aliases: string[];
          code: string;
          kind: Database['public']['Enums']['unit_kind'];
          label: string;
          label_plural: string;
          sort_order: number;
          to_base: number | null;
        };
        Insert: {
          aliases?: string[];
          code: string;
          kind: Database['public']['Enums']['unit_kind'];
          label: string;
          label_plural: string;
          sort_order?: number;
          to_base?: number | null;
        };
        Update: {
          aliases?: string[];
          code?: string;
          kind?: Database['public']['Enums']['unit_kind'];
          label?: string;
          label_plural?: string;
          sort_order?: number;
          to_base?: number | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_household_invite: { Args: { p_token: string }; Returns: string };
      create_household: { Args: { p_name: string }; Returns: string };
      create_household_invite: {
        Args: {
          p_email?: string;
          p_household_id: string;
          p_role?: Database['public']['Enums']['household_role'];
        };
        Returns: string;
      };
      get_recipe: { Args: { p_recipe_id: string }; Returns: Json };
      get_recipes_since: {
        Args: { p_household_id: string; p_limit?: number; p_since?: string };
        Returns: Json[];
      };
      list_household_members: {
        Args: { p_household_id: string };
        Returns: {
          display_name: string;
          is_me: boolean;
          joined_at: string;
          role: Database['public']['Enums']['household_role'];
          user_id: string;
        }[];
      };
      my_households: {
        Args: Record<PropertyKey, never>;
        Returns: {
          created_at: string;
          id: string;
          member_count: number;
          name: string;
          role: Database['public']['Enums']['household_role'];
        }[];
      };
      remove_household_member: {
        Args: { p_household_id: string; p_user_id: string };
        Returns: undefined;
      };
      revoke_household_invite: { Args: { p_invite_id: string }; Returns: undefined };
      save_recipe: { Args: { p_recipe: Json }; Returns: Json };
      search_recipes: {
        Args: {
          p_category_ids?: string[];
          p_difficulties?: Database['public']['Enums']['recipe_difficulty'][];
          p_favorites_only?: boolean;
          p_has_family_history?: boolean;
          p_household_id: string;
          p_include_archived?: boolean;
          p_ingredients?: string[];
          p_limit?: number;
          p_max_prep_minutes?: number;
          p_max_total_minutes?: number;
          p_meal_types?: string[];
          p_offset?: number;
          p_origin_person_id?: string;
          p_query?: string;
          p_sort?: string;
          p_tag_ids?: string[];
        };
        Returns: {
          archived_at: string;
          category_icon: string;
          category_id: string;
          category_name: string;
          cook_minutes: number;
          cover_path: string;
          description: string;
          difficulty: Database['public']['Enums']['recipe_difficulty'];
          has_story: boolean;
          household_id: string;
          id: string;
          is_favorite: boolean;
          legacy_author: string;
          meal_types: string[];
          origin_person_name: string;
          origin_text: string;
          prep_minutes: number;
          rank: number;
          servings: number;
          title: string;
          total_count: number;
          total_minutes: number;
          updated_at: string;
          yield_unit: string;
        }[];
      };
      set_favorite: { Args: { p_favorite: boolean; p_recipe_id: string }; Returns: boolean };
      set_household_member_role: {
        Args: {
          p_household_id: string;
          p_role: Database['public']['Enums']['household_role'];
          p_user_id: string;
        };
        Returns: undefined;
      };
      set_recipe_archived: {
        Args: { p_archived: boolean; p_recipe_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      household_role: 'owner' | 'admin' | 'member' | 'viewer';
      media_kind: 'photo' | 'original_scan' | 'historical_photo' | 'document';
      note_visibility: 'private' | 'household';
      recipe_difficulty: 'easy' | 'medium' | 'hard';
      recipe_source_type:
        'manual' | 'legacy_import' | 'url' | 'text' | 'image' | 'pdf' | 'scan' | 'other';
      unit_kind: 'mass' | 'volume' | 'count' | 'other';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      household_role: ['owner', 'admin', 'member', 'viewer'],
      media_kind: ['photo', 'original_scan', 'historical_photo', 'document'],
      note_visibility: ['private', 'household'],
      recipe_difficulty: ['easy', 'medium', 'hard'],
      recipe_source_type: [
        'manual',
        'legacy_import',
        'url',
        'text',
        'image',
        'pdf',
        'scan',
        'other',
      ],
      unit_kind: ['mass', 'volume', 'count', 'other'],
    },
  },
} as const;
