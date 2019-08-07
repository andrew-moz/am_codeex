

         # Controller

  def create_with_activation
    if can_create_user_with_activation?
      ApplicationRecord.transaction do
        resource.save
        subscription_data = subscription_params
        subscription_data[:stripeToken] = params[:stripeToken]

        if activation_has_existing_user?(sign_up_params[:activation_code])
          service = Subscription::Activate.new(resource, sign_up_params[:activation_code])
        else

          subscription_data[:shared_subscription] = activation_exists?(sign_up_params[:activation_code])

          service = Subscription::Create.new(resource, subscription_data)
          service.plan_type_check
        end

        service.call

        resource.set_activation(activation)

        yield resource if block_given?

        sync = Subscription::Sync.new(self.resource, service.stripe_subscription)
        sync.call

        set_flash_message! :notice, :"signed_up_but_#{resource.inactive_message}"
        expire_data_after_sign_in!
        respond_with resource, location: new_user_session_path
      end
    else
      clean_up_resource

      if !activation
        resource.errors[:activation_code] << ' does not exist. Please refer to your Activation Invitation or contact your administrator'
      end

      respond_with resource, location: new_user_registration_path
    end
  end

  def activation_has_existing_user?(code)
    activation = Activation.find_by(activation_code: code)
    activation && activation.users.any?
  end

  def can_create_user_with_activation?
    activation&.can_add_user?
  end


         # Model

module Queryable

  def one_time(user)
    self.where(parent_id: nil, user_id: user.id)
    .includes(:survey_recurring_info, :survey_answers)
    .where(:survey_recurring_info => { :survey_id => nil })
  end

  def recurring(user, order = :desc)
    self.where(parent_id: nil, user_id: user.id)
    .includes(:survey_recurring_info, :survey_answers, :children, :survey_notes)
    .where.not(:survey_recurring_info => { :survey_id => nil })
    .order(id: order)
  end

  def find_one_time_active(user)
    relation = one_time(user)
    ids = relation.select { |survey| survey.active? }.map(&:id)
    Survey.where(id: ids)
  end

  def find_one_time_scheduled(user)
    relation = one_time(user)
    scheduled_settings(relation)
  end

  def find_one_time_completed(user)
    relation = one_time(user)
    ids = relation.select { |survey| survey.closed? }.map(&:id)
    Survey.where(id: ids)
  end

  def find_recurring_active(user)
    relation = recurring(user)
    active_settings(relation)
  end

  def find_recurring_scheduled(user)
    relation = recurring(user)
    scheduled_settings(relation)
  end

  def find_recurring_completed(user)
    relation = recurring(user)
    completed_settings(relation)
  end

  def find_draft(user)
    relation = one_time(user)
    draft_settings(relation)
  end

  def by_group(relation, groups)
    member_ids = TeamMember.where('groups @> ARRAY[?]::varchar[]', groups).pluck('id')
    survey_ids = SurveyAnswer.where(team_member_id: member_ids).pluck('survey_id')
    relation.where(id: survey_ids)
  end

  private

  def active_settings(relation)
    relation.where(["survey_answers.finished_at is null"])
    .where.not('surveys.start_date' => nil)
    .where.not('surveys.close_date' => nil)
    .where('surveys.start_date >= ?', Date.current - 5.days)
    .where.not('surveys.close_date < ?', Date.current)
    .where('surveys.sent' => true)
  end

  def completed_settings(relation)
    relation.where(["(surveys.start_date is not null and surveys.close_date is not null) and (surveys.close_date < ?)", Date.current])
  end

  def scheduled_settings(relation)
    relation.where.not('surveys.start_date' =>  nil)
    .where.not('surveys.close_date' => nil)
    .where('surveys.close_date > ?', Date.current + 5.days)
    .where('surveys.anonymous' => nil)
    .where('surveys.sent' => false)
  end

  def draft_settings(relation)
    relation.where('surveys.start_date' => nil)
    .where('surveys.sent' => false)
  end

end

        # Services

  class Subscription
  class Activate < Base

    PREMIUM_MEMBERS_COUNT = 15.freeze

    def initialize(user, activation_code)
      @user = user
      @act_code = activation_code
    end

    def call
      activation = Activation.find_by(activation_code: @act_code)
      sub = activation.users.first.subscription

      ApplicationRecord.transaction do
        @user.create_subscription(
          plan_type: sub[:plan_type],
          payment_method: sub[:payment_method],
          customer_stripe_id: sub[:customer_stripe_id],
          subscription_stripe_id: sub[:subscription_stripe_id],
          shared_subscription: true
        )

        @user.update(
          allowed_member_count: PREMIUM_MEMBERS_COUNT,
          expires_at: 1.year.from_now
        )
      end
    end

  end
end


